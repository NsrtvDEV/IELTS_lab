from django import forms
from django.contrib import admin, messages
from django.db.models import Count

import uuid
from pathlib import Path

from app.config import settings as app_settings
from app.media import _duration, media_path
from app.models import SectionType
from app.routers.teacher.uploads import AUDIO_TYPES
from app.utils import hash_password

from .models import (
    BandConversion,
    CorrectAnswer,
    IeltsTest,
    Passage,
    Question,
    QuestionGroup,
    QuestionOption,
    Section,
    SectionAttempt,
    SpeakingAssessment,
    SpeakingResponse,
    SpeakingTask,
    TestAttempt,
    User,
    UserProfile,
    WritingAssessment,
    WritingResponse,
    WritingTask,
)

# ───────────────────────── Users ─────────────────────────


class UserForm(forms.ModelForm):
    new_password = forms.CharField(
        label="Новый пароль",
        required=False,
        min_length=8,
        widget=forms.PasswordInput(render_value=False),
        help_text="Оставьте пустым, чтобы не менять. Хранится как argon2-хеш, как в API.",
    )

    class Meta:
        model = User
        fields = ["email", "role", "is_active"]

    def clean(self):
        data = super().clean()
        if not self.instance.pk and not data.get("new_password"):
            self.add_error("new_password", "Для нового пользователя пароль обязателен")
        return data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = user.email.lower()
        if self.cleaned_data.get("new_password"):
            user.password_hash = hash_password(self.cleaned_data["new_password"])
        if commit:
            user.save()
        return user


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    form = UserForm
    inlines = [UserProfileInline]
    list_display = ["email", "role", "is_active", "created_at"]
    list_filter = ["role", "is_active"]
    search_fields = ["email", "profile__first_name", "profile__last_name"]
    readonly_fields = ["created_at"]
    ordering = ["-created_at"]


# ───────────────────────── Tests ─────────────────────────


def publish_errors(test: IeltsTest) -> list[str]:
    """Проверки перед публикацией (раздел 2.10 TZ.md)."""
    errors = []
    sections = {s.type: s for s in test.sections.all()}

    for section_type in SectionType:
        if section_type.value not in sections:
            errors.append(f"нет секции {section_type.value}")

    for section_type in (SectionType.LISTENING, SectionType.READING):
        section = sections.get(section_type.value)
        if not section:
            continue
        questions = Question.objects.filter(group__section=section).annotate(
            n_correct=Count("correct_answers")
        )
        if questions.count() != 40:
            errors.append(f"{section_type.value}: {questions.count()} вопросов вместо 40")
        without_answer = [q.number for q in questions if q.n_correct == 0]
        if without_answer:
            errors.append(f"{section_type.value}: нет правильного ответа у Q{without_answer}")

    writing = sections.get(SectionType.WRITING.value)
    if writing and set(writing.writing_tasks.values_list("task_number", flat=True)) != {1, 2}:
        errors.append("writing: нужны Task 1 и Task 2")

    speaking = sections.get(SectionType.SPEAKING.value)
    if speaking and set(speaking.speaking_tasks.values_list("part", flat=True)) != {1, 2, 3}:
        errors.append("speaking: нужны Part 1, 2 и 3")

    return errors


class IeltsTestForm(forms.ModelForm):
    class Meta:
        model = IeltsTest
        fields = ["title", "is_published"]

    def clean_is_published(self):
        value = self.cleaned_data["is_published"]
        if value and (not self.instance.pk or publish_errors(self.instance)):
            errors = publish_errors(self.instance) if self.instance.pk else ["тест пустой"]
            raise forms.ValidationError("Нельзя опубликовать: " + "; ".join(errors))
        return value


class SectionInline(admin.TabularInline):
    model = Section
    extra = 0
    show_change_link = True
    fields = ["type", "duration_min", "position"]


@admin.register(IeltsTest)
class IeltsTestAdmin(admin.ModelAdmin):
    form = IeltsTestForm
    inlines = [SectionInline]
    list_display = ["title", "is_published", "created_at"]
    list_filter = ["is_published"]
    search_fields = ["title"]
    actions = ["publish", "unpublish"]

    @admin.action(description="Опубликовать выбранные тесты")
    def publish(self, request, queryset):
        for test in queryset:
            errors = publish_errors(test)
            if errors:
                self.message_user(
                    request, f"«{test}» не опубликован: {'; '.join(errors)}", messages.ERROR
                )
            else:
                test.is_published = True
                test.save(update_fields=["is_published"])
                self.message_user(request, f"«{test}» опубликован")

    @admin.action(description="Снять с публикации")
    def unpublish(self, request, queryset):
        queryset.update(is_published=False)


class PassageForm(forms.ModelForm):
    """Текст или запись: у Listening файл можно загрузить прямо здесь."""

    upload_audio = forms.FileField(
        label="Загрузить запись",
        required=False,
        help_text=f"MP3, M4A, WAV или OGG до {app_settings.MAX_LISTENING_AUDIO_MB} МБ — заменит ссылку выше",
    )

    class Meta:
        model = Passage
        fields = ["title", "text", "audio_url", "position"]

    def clean_upload_audio(self):
        file = self.cleaned_data.get("upload_audio")
        if not file:
            return None
        if file.content_type not in AUDIO_TYPES:
            raise forms.ValidationError("Загрузите аудиофайл: MP3, M4A, AAC, WAV, OGG или WEBM")
        if file.size > app_settings.MAX_LISTENING_AUDIO_MB * 1024 * 1024:
            raise forms.ValidationError(f"Файл больше {app_settings.MAX_LISTENING_AUDIO_MB} МБ")
        return file

    def save(self, commit=True):
        passage = super().save(commit=False)
        file = self.cleaned_data.get("upload_audio")
        if file:
            name = f"{uuid.uuid4().hex}{AUDIO_TYPES[file.content_type]}"
            path = Path(app_settings.MEDIA_ROOT) / "audio" / name
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("wb") as out:
                for chunk in file.chunks():
                    out.write(chunk)
            passage.audio_url = f"/media/audio/{name}"
        if "audio_url" in self.changed_data or file:
            path = media_path(passage.audio_url)  # у внешних ссылок длина неизвестна
            passage.audio_duration_sec = _duration(path) if path and path.is_file() else None
        if commit:
            passage.save()
        return passage


class PassageInline(admin.StackedInline):
    model = Passage
    form = PassageForm
    extra = 0
    readonly_fields = ["audio_duration_sec"]


class QuestionGroupInline(admin.TabularInline):
    model = QuestionGroup
    extra = 0
    show_change_link = True
    fields = ["position", "type", "instruction", "passage", "word_limit", "allow_number"]


class WritingTaskInline(admin.StackedInline):
    model = WritingTask
    extra = 0


class SpeakingTaskInline(admin.StackedInline):
    model = SpeakingTask
    extra = 0


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ["test", "type", "duration_min"]
    list_filter = ["type", "test"]

    def get_inlines(self, request, obj):
        # у каждой секции свой вид содержимого
        if obj is None:
            return []
        return {
            SectionType.LISTENING.value: [PassageInline, QuestionGroupInline],
            SectionType.READING.value: [PassageInline, QuestionGroupInline],
            SectionType.WRITING.value: [WritingTaskInline],
            SectionType.SPEAKING.value: [SpeakingTaskInline],
        }[obj.type]


class GroupOptionInline(admin.TabularInline):
    model = QuestionOption
    fk_name = "group"
    extra = 0
    fields = ["position", "label", "text"]
    verbose_name_plural = "общие варианты (для matching)"


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 0
    show_change_link = True
    fields = ["number", "text", "answers_required", "points"]


@admin.register(QuestionGroup)
class QuestionGroupAdmin(admin.ModelAdmin):
    inlines = [QuestionInline, GroupOptionInline]
    list_display = ["__str__", "type", "word_limit"]
    list_filter = ["type", "section__test"]

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # текст — только из той же секции
        if db_field.name == "passage":
            object_id = request.resolver_match.kwargs.get("object_id")
            group = QuestionGroup.objects.filter(pk=object_id).first()
            if group:
                kwargs["queryset"] = Passage.objects.filter(section=group.section)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    fk_name = "question"
    extra = 0
    fields = ["position", "label", "text"]


class CorrectAnswerInline(admin.TabularInline):
    model = CorrectAnswer
    extra = 1
    fields = ["option", "answer_text"]
    verbose_name_plural = (
        "правильные ответы: вариант (все обязательны) или текст (любой из вариантов написания)"
    )

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # только варианты этого вопроса и его группы
        if db_field.name == "option":
            object_id = request.resolver_match.kwargs.get("object_id")
            question = Question.objects.filter(pk=object_id).first()
            if question:
                kwargs["queryset"] = QuestionOption.objects.filter(
                    question=question
                ) | QuestionOption.objects.filter(group=question.group)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    inlines = [QuestionOptionInline, CorrectAnswerInline]
    list_display = ["number", "text", "group"]
    list_filter = ["group__type", "group__section__test"]
    search_fields = ["text"]


@admin.register(BandConversion)
class BandConversionAdmin(admin.ModelAdmin):
    list_display = ["section_type", "raw_score", "band"]
    list_filter = ["section_type"]


# ───────────────────────── Attempts (только просмотр) ─────────────────────────


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class SectionAttemptInline(admin.TabularInline):
    model = SectionAttempt
    extra = 0
    show_change_link = True
    fields = ["section", "started_at", "submitted_at", "raw_score", "band_score"]
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(TestAttempt)
class TestAttemptAdmin(ReadOnlyAdmin):
    inlines = [SectionAttemptInline]
    list_display = ["id", "user", "test", "section_type", "status", "overall_band", "started_at"]
    list_filter = ["status", "section_type", "test"]
    search_fields = ["user__email"]


class WritingResponseInline(admin.StackedInline):
    model = WritingResponse
    extra = 0
    fields = ["task", "text", "word_count"]
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class SpeakingResponseInline(admin.TabularInline):
    model = SpeakingResponse
    extra = 0
    fields = ["task", "audio_url", "duration_sec", "transcript"]
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class SpeakingAssessmentInline(admin.TabularInline):
    model = SpeakingAssessment
    extra = 0
    fields = [
        "grader_type", "grader", "fluency_coherence", "lexical_resource",
        "grammatical_range", "pronunciation", "band", "feedback",
    ]
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(SectionAttempt)
class SectionAttemptAdmin(ReadOnlyAdmin):
    inlines = [WritingResponseInline, SpeakingResponseInline, SpeakingAssessmentInline]
    list_display = ["id", "attempt", "section", "submitted_at", "band_score"]
    list_filter = ["section__type"]


@admin.register(WritingAssessment)
class WritingAssessmentAdmin(ReadOnlyAdmin):
    list_display = ["response", "grader_type", "grader", "band", "created_at"]
    list_filter = ["grader_type"]
