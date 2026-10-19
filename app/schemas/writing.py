"""Writing: задания, черновики ученика, оценка преподавателем."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models import SectionType

Criterion = Annotated[int, Field(ge=0, le=9)]  # оценка по критерию — целое 0–9
Prompt = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]

# ───────────────────────── Задания (учитель) ─────────────────────────


class WritingTaskCreate(BaseModel):
    task_number: Literal[1, 2]
    prompt: Prompt
    image_url: str | None = Field(default=None, max_length=500)  # график/таблица/карта для Task 1
    min_words: int | None = Field(default=None, ge=20, le=1000)  # по умолчанию 150 / 250
    recommended_min: int | None = Field(default=None, ge=1, le=120)  # по умолчанию 20 / 40


class WritingTaskUpdate(BaseModel):
    prompt: Prompt | None = None
    image_url: str | None = Field(default=None, max_length=500)
    min_words: int | None = Field(default=None, ge=20, le=1000)
    recommended_min: int | None = Field(default=None, ge=1, le=120)


class WritingTaskOut(BaseModel):
    id: int
    task_number: int
    prompt: str
    image_url: str | None
    min_words: int
    recommended_min: int

    model_config = ConfigDict(from_attributes=True)


# ───────────────────────── Прохождение (ученик) ─────────────────────────


class WritingDraft(BaseModel):
    task_id: int
    text: str
    word_count: int


class WritingContent(BaseModel):
    section_attempt_id: int
    attempt_id: int
    deadline: datetime
    tasks: list[WritingTaskOut]
    responses: list[WritingDraft]  # сохранённые тексты — для продолжения после обрыва связи


class WritingSave(BaseModel):
    text: str = Field(max_length=20_000)


# ───────────────────────── Оценка ─────────────────────────


class CriteriaScores(BaseModel):
    task_response: Criterion  # Task Achievement (Task 1) / Task Response (Task 2)
    coherence_cohesion: Criterion
    lexical_resource: Criterion
    grammatical_range: Criterion


class InlineComment(BaseModel):
    """Комментарий учителя к фрагменту эссе: text[start:end] == quote."""

    start: int = Field(ge=0)
    end: int = Field(gt=0)
    quote: str = Field(min_length=1, max_length=5000)  # выделенный фрагмент — сверяется с текстом
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class TaskAssessmentIn(CriteriaScores):
    task_id: int
    feedback: Annotated[str, StringConstraints(strip_whitespace=True, max_length=10_000)] | None = None
    comments: list[InlineComment] = Field(default=[], max_length=100)


class WritingAssessmentIn(BaseModel):
    tasks: list[TaskAssessmentIn] = Field(min_length=1)


class AssessmentOut(CriteriaScores):
    band: Decimal
    feedback: str | None
    comments: list[InlineComment]  # по порядку в тексте
    grader_name: str | None
    created_at: datetime


class WritingTaskResult(BaseModel):
    task_id: int
    task_number: int
    prompt: str
    image_url: str | None
    min_words: int
    text: str
    word_count: int
    assessment: AssessmentOut | None


class WritingResult(BaseModel):
    section_attempt_id: int
    attempt_id: int
    test_title: str
    submitted_at: datetime | None
    time_spent_sec: int | None
    band_score: Decimal | None
    status: Literal["pending", "assessed"]  # ждёт проверки или оценено
    tasks: list[WritingTaskResult]


# ───────────────────────── Очередь проверки Writing и Speaking (учитель) ─────────────────────────


class ReviewItem(BaseModel):
    section_attempt_id: int
    section_type: SectionType  # writing или speaking
    student_id: int
    student_name: str
    student_email: str
    student_avatar_url: str | None = None
    test_title: str
    mode: Literal["section", "mock"]
    submitted_at: datetime
    word_counts: list[int]  # Writing: по заданиям Task 1, Task 2
    answered: int | None = None  # Speaking: сколько вопросов с записью ответа
    questions: int | None = None  # Speaking: сколько вопросов всего
    band_score: Decimal | None  # None — ещё не проверено


class ReviewDetail(WritingResult):
    student_id: int
    student_name: str
    student_email: str
    student_avatar_url: str | None = None
