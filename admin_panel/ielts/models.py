"""Django-зеркало таблиц из app/models.py.

Все модели `managed = False`: таблицы создаёт и меняет только Alembic.
При изменении app/models.py обновите и этот файл.
"""

import enum

from django.db import models
from django.db.models.functions import Now

from app.models import (
    AttemptStatus,
    QuestionType,
    SectionType,
    UserRole,
)


def choices(enum_cls: type[enum.Enum]) -> list[tuple[str, str]]:
    return [(m.value, m.name.replace("_", " ").title()) for m in enum_cls]


class Unmanaged(models.Model):
    class Meta:
        abstract = True
        managed = False


# ───────────────────────── Users ─────────────────────────


class User(Unmanaged):
    email = models.EmailField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=255, editable=False)
    role = models.CharField(max_length=20, choices=choices(UserRole), default=UserRole.STUDENT.value)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(db_default=Now(), editable=False)
    updated_at = models.DateTimeField(db_default=Now(), auto_now=True)

    class Meta(Unmanaged.Meta):
        db_table = "users"
        verbose_name = "пользователь"
        verbose_name_plural = "пользователи"

    def __str__(self):
        return self.email


class UserProfile(Unmanaged):
    user = models.OneToOneField(User, models.CASCADE, primary_key=True, related_name="profile")
    first_name = models.CharField("имя", max_length=100, null=True, blank=True)
    last_name = models.CharField("фамилия", max_length=100, null=True, blank=True)
    native_language = models.CharField(max_length=50, null=True, blank=True)
    phone = models.CharField("телефон", max_length=30, null=True, blank=True)
    location = models.CharField("город", max_length=100, null=True, blank=True)
    bio = models.TextField("о себе", null=True, blank=True)
    avatar_url = models.CharField("фото", max_length=500, null=True, blank=True)

    class Meta(Unmanaged.Meta):
        db_table = "user_profiles"
        verbose_name = "профиль"
        verbose_name_plural = "профили"


class RefreshToken(Unmanaged):
    user = models.ForeignKey(User, models.CASCADE)
    token_hash = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(db_default=Now())

    class Meta(Unmanaged.Meta):
        db_table = "refresh_tokens"


# ───────────────────────── Test content ─────────────────────────


class IeltsTest(Unmanaged):
    title = models.CharField(max_length=255)
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        User, models.SET_NULL, null=True, blank=True, db_column="created_by_id", verbose_name="автор"
    )
    created_at = models.DateTimeField(db_default=Now(), editable=False)
    updated_at = models.DateTimeField(db_default=Now(), auto_now=True)

    class Meta(Unmanaged.Meta):
        db_table = "tests"
        verbose_name = "mock-тест"
        verbose_name_plural = "mock-тесты"

    def __str__(self):
        return self.title


class Section(Unmanaged):
    test = models.ForeignKey(IeltsTest, models.CASCADE, related_name="sections")
    type = models.CharField(max_length=20, choices=choices(SectionType))
    duration_min = models.IntegerField("длительность, мин")
    position = models.IntegerField(default=0)

    class Meta(Unmanaged.Meta):
        db_table = "sections"
        ordering = ["test", "position"]
        unique_together = [("test", "type")]
        verbose_name = "секция"
        verbose_name_plural = "секции"

    def __str__(self):
        return f"{self.test} — {self.get_type_display()}"


class Passage(Unmanaged):
    section = models.ForeignKey(Section, models.CASCADE, related_name="passages")
    title = models.CharField(max_length=255, null=True, blank=True)
    text = models.TextField(null=True, blank=True)
    audio_url = models.CharField(max_length=500, null=True, blank=True)
    audio_duration_sec = models.IntegerField("длина записи, сек", null=True, blank=True, editable=False)
    position = models.IntegerField(default=0)

    class Meta(Unmanaged.Meta):
        db_table = "passages"
        ordering = ["section", "position"]
        verbose_name = "текст / аудио"
        verbose_name_plural = "тексты и аудио"

    def __str__(self):
        return self.title or f"Passage {self.position + 1}"


class QuestionGroup(Unmanaged):
    section = models.ForeignKey(Section, models.CASCADE, related_name="question_groups")
    passage = models.ForeignKey(Passage, models.SET_NULL, null=True, blank=True, related_name="question_groups")
    type = models.CharField(max_length=40, choices=choices(QuestionType))
    instruction = models.TextField()
    word_limit = models.SmallIntegerField(null=True, blank=True)
    allow_number = models.BooleanField(default=False)
    position = models.IntegerField(default=0)
    meta = models.JSONField(null=True, blank=True)

    class Meta(Unmanaged.Meta):
        db_table = "question_groups"
        ordering = ["section", "position"]
        verbose_name = "группа вопросов"
        verbose_name_plural = "группы вопросов"

    def __str__(self):
        numbers = [q.number for q in self.questions.all()]
        span = f"Questions {min(numbers)}–{max(numbers)}" if numbers else "без вопросов"
        return f"{self.section}: {span} ({self.get_type_display()})"


class Question(Unmanaged):
    group = models.ForeignKey(QuestionGroup, models.CASCADE, related_name="questions")
    number = models.SmallIntegerField()
    text = models.TextField(null=True, blank=True)
    answers_required = models.SmallIntegerField(default=1)
    points = models.IntegerField(default=1)
    meta = models.JSONField(null=True, blank=True)

    class Meta(Unmanaged.Meta):
        db_table = "questions"
        ordering = ["group", "number"]
        verbose_name = "вопрос"
        verbose_name_plural = "вопросы"

    def __str__(self):
        return f"Q{self.number}: {(self.text or '')[:60]}"


class QuestionOption(Unmanaged):
    question = models.ForeignKey(Question, models.CASCADE, null=True, blank=True, related_name="options")
    group = models.ForeignKey(QuestionGroup, models.CASCADE, null=True, blank=True, related_name="options")
    label = models.CharField(max_length=10)
    text = models.TextField()
    position = models.IntegerField(default=0)

    class Meta(Unmanaged.Meta):
        db_table = "question_options"
        ordering = ["position"]
        verbose_name = "вариант ответа"
        verbose_name_plural = "варианты ответа"

    def __str__(self):
        return f"{self.label}. {self.text[:60]}"


class CorrectAnswer(Unmanaged):
    question = models.ForeignKey(Question, models.CASCADE, related_name="correct_answers")
    option = models.ForeignKey(QuestionOption, models.CASCADE, null=True, blank=True)
    answer_text = models.CharField(max_length=255, null=True, blank=True)

    class Meta(Unmanaged.Meta):
        db_table = "correct_answers"
        verbose_name = "правильный ответ"
        verbose_name_plural = "правильные ответы"


class WritingTask(Unmanaged):
    section = models.ForeignKey(Section, models.CASCADE, related_name="writing_tasks")
    task_number = models.SmallIntegerField(choices=[(1, "Task 1"), (2, "Task 2")])
    prompt = models.TextField()
    image_url = models.CharField(max_length=500, null=True, blank=True)
    min_words = models.SmallIntegerField()
    recommended_min = models.SmallIntegerField("рекомендуемое время, мин")

    class Meta(Unmanaged.Meta):
        db_table = "writing_tasks"
        ordering = ["section", "task_number"]
        verbose_name = "задание Writing"
        verbose_name_plural = "задания Writing"


class SpeakingTask(Unmanaged):
    section = models.ForeignKey(Section, models.CASCADE, related_name="speaking_tasks")
    part = models.SmallIntegerField(choices=[(1, "Part 1"), (2, "Part 2"), (3, "Part 3")])
    position = models.IntegerField(default=0)
    prompt = models.TextField()
    cue_card_points = models.JSONField(null=True, blank=True)
    prep_time_sec = models.IntegerField(null=True, blank=True)
    speak_time_sec = models.IntegerField(null=True, blank=True)
    sample_answer = models.TextField("примерный ответ", null=True, blank=True)

    class Meta(Unmanaged.Meta):
        db_table = "speaking_tasks"
        ordering = ["section", "part", "position"]
        verbose_name = "задание Speaking"
        verbose_name_plural = "задания Speaking"


class BandConversion(Unmanaged):
    section_type = models.CharField(
        max_length=20,
        choices=[
            (SectionType.LISTENING.value, "Listening"),
            (SectionType.READING.value, "Reading"),
        ],
    )
    raw_score = models.IntegerField()
    band = models.DecimalField(max_digits=2, decimal_places=1)

    class Meta(Unmanaged.Meta):
        db_table = "band_conversion"
        ordering = ["section_type", "-raw_score"]
        unique_together = [("section_type", "raw_score")]
        verbose_name = "перевод баллов в band"
        verbose_name_plural = "шкала перевода баллов"


# ───────────────────────── Attempts ─────────────────────────


class TestAttempt(Unmanaged):
    __test__ = False

    user = models.ForeignKey(User, models.CASCADE, related_name="attempts")
    test = models.ForeignKey(IeltsTest, models.PROTECT, related_name="attempts")
    status = models.CharField(max_length=20, choices=choices(AttemptStatus))
    section_type = models.CharField(max_length=20, choices=choices(SectionType), null=True, blank=True)
    started_at = models.DateTimeField(db_default=Now())
    finished_at = models.DateTimeField(null=True, blank=True)
    overall_band = models.DecimalField(max_digits=2, decimal_places=1, null=True)

    class Meta(Unmanaged.Meta):
        db_table = "test_attempts"
        ordering = ["-started_at"]
        verbose_name = "попытка"
        verbose_name_plural = "попытки"

    def __str__(self):
        mode = self.get_section_type_display() if self.section_type else "полный экзамен"
        return f"#{self.pk} {self.user} — {self.test} ({mode})"


class SectionAttempt(Unmanaged):
    attempt = models.ForeignKey(TestAttempt, models.CASCADE, related_name="section_attempts")
    section = models.ForeignKey(Section, models.PROTECT)
    started_at = models.DateTimeField(db_default=Now())
    submitted_at = models.DateTimeField(null=True, blank=True)
    raw_score = models.IntegerField(null=True)
    band_score = models.DecimalField(max_digits=2, decimal_places=1, null=True)
    time_spent_sec = models.IntegerField(null=True)
    playback = models.JSONField(null=True, blank=True)

    class Meta(Unmanaged.Meta):
        db_table = "section_attempts"
        verbose_name = "секция попытки"
        verbose_name_plural = "секции попыток"


class UserAnswer(Unmanaged):
    section_attempt = models.ForeignKey(SectionAttempt, models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, models.PROTECT)
    answer_text = models.TextField(null=True)
    is_correct = models.BooleanField(null=True)

    class Meta(Unmanaged.Meta):
        db_table = "user_answers"


class WritingResponse(Unmanaged):
    section_attempt = models.ForeignKey(SectionAttempt, models.CASCADE, related_name="writing_responses")
    task = models.ForeignKey(WritingTask, models.PROTECT)
    text = models.TextField(default="")
    word_count = models.IntegerField(default=0)
    submitted_at = models.DateTimeField(null=True)

    class Meta(Unmanaged.Meta):
        db_table = "writing_responses"
        verbose_name = "ответ Writing"
        verbose_name_plural = "ответы Writing"


class SpeakingResponse(Unmanaged):
    section_attempt = models.ForeignKey(SectionAttempt, models.CASCADE, related_name="speaking_responses")
    task = models.ForeignKey(SpeakingTask, models.PROTECT)
    audio_url = models.CharField(max_length=500, null=True)
    transcript = models.TextField(null=True)
    duration_sec = models.IntegerField(null=True)

    class Meta(Unmanaged.Meta):
        db_table = "speaking_responses"
        verbose_name = "ответ Speaking"
        verbose_name_plural = "ответы Speaking"


class WritingAssessment(Unmanaged):
    response = models.ForeignKey(WritingResponse, models.CASCADE, related_name="assessments")
    grader = models.ForeignKey(User, models.SET_NULL, null=True, related_name="+")
    task_response = models.SmallIntegerField()
    coherence_cohesion = models.SmallIntegerField()
    lexical_resource = models.SmallIntegerField()
    grammatical_range = models.SmallIntegerField()
    band = models.DecimalField(max_digits=2, decimal_places=1)
    feedback = models.TextField(null=True)
    created_at = models.DateTimeField(db_default=Now())

    class Meta(Unmanaged.Meta):
        db_table = "writing_assessments"
        verbose_name = "оценка Writing"
        verbose_name_plural = "оценки Writing"


class SpeakingAssessment(Unmanaged):
    section_attempt = models.ForeignKey(SectionAttempt, models.CASCADE, related_name="speaking_assessments")
    grader = models.ForeignKey(User, models.SET_NULL, null=True, related_name="+")
    fluency_coherence = models.SmallIntegerField()
    lexical_resource = models.SmallIntegerField()
    grammatical_range = models.SmallIntegerField()
    pronunciation = models.SmallIntegerField()
    band = models.DecimalField(max_digits=2, decimal_places=1)
    feedback = models.TextField(null=True)
    created_at = models.DateTimeField(db_default=Now())

    class Meta(Unmanaged.Meta):
        db_table = "speaking_assessments"
        verbose_name = "оценка Speaking"
        verbose_name_plural = "оценки Speaking"
