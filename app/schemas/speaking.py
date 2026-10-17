"""Speaking: вопросы Part 1–3, записи ответов ученика, оценка преподавателем."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.writing import Criterion

Prompt = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
CuePoint = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
PrepTime = Annotated[int, Field(ge=0, le=300)]
SpeakTime = Annotated[int, Field(ge=10, le=300)]
SampleAnswer = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]

# ───────────────────────── Вопросы (учитель) ─────────────────────────


class SpeakingTaskCreate(BaseModel):
    part: Literal[1, 2, 3]
    prompt: Prompt  # Part 1/3 — вопрос, Part 2 — тема карточки
    cue_card_points: list[CuePoint] | None = Field(default=None, max_length=8)  # Part 2: "You should say: ..."
    prep_time_sec: PrepTime | None = None  # по умолчанию: Part 2 — 60
    speak_time_sec: SpeakTime | None = None  # по умолчанию: 30 / 120 / 60
    position: int | None = Field(default=None, ge=0)  # по умолчанию — в конец части
    sample_answer: SampleAnswer | None = None  # примерный ответ; нужен для публикации


class SpeakingTaskUpdate(BaseModel):
    prompt: Prompt | None = None
    cue_card_points: list[CuePoint] | None = Field(default=None, max_length=8)
    prep_time_sec: PrepTime | None = None
    speak_time_sec: SpeakTime | None = None
    position: int | None = Field(default=None, ge=0)
    sample_answer: SampleAnswer | None = None


class SpeakingTaskOut(BaseModel):
    """Вопрос, каким его видит ученик во время теста — без примерного ответа."""

    id: int
    part: int
    position: int
    prompt: str
    cue_card_points: list[str]
    prep_time_sec: int  # 0 — без подготовки
    speak_time_sec: int  # сколько длится ответ


class TeacherSpeakingTask(SpeakingTaskOut):
    sample_answer: str | None


# ───────────────────────── Прохождение (ученик) ─────────────────────────


class SpeakingContent(BaseModel):
    section_attempt_id: int
    attempt_id: int
    deadline: datetime
    tasks: list[SpeakingTaskOut]  # в порядке экзамена: Part 1 → 2 → 3
    answered_task_ids: list[int]  # уже записанные ответы — после обрыва связи продолжаем со следующего


class SpeakingRecording(BaseModel):
    task_id: int
    response_id: int
    duration_sec: int | None


# ───────────────────────── Оценка ─────────────────────────


class SpeakingScores(BaseModel):
    fluency_coherence: Criterion
    lexical_resource: Criterion
    grammatical_range: Criterion
    pronunciation: Criterion


class SpeakingAssessmentIn(SpeakingScores):
    feedback: Annotated[str, StringConstraints(strip_whitespace=True, max_length=10_000)] | None = None


class SpeakingAssessmentOut(SpeakingScores):
    band: Decimal
    feedback: str | None
    grader_name: str | None
    created_at: datetime


class SpeakingTaskResult(TeacherSpeakingTask):
    """После сдачи: запись ответа ученика рядом с примерным ответом."""

    response_id: int | None  # None — ответа нет (время вышло или вопрос пропущен)
    duration_sec: int | None


class SpeakingResult(BaseModel):
    section_attempt_id: int
    attempt_id: int
    test_title: str
    submitted_at: datetime | None
    time_spent_sec: int | None
    band_score: Decimal | None
    status: Literal["pending", "assessed"]
    tasks: list[SpeakingTaskResult]
    assessment: SpeakingAssessmentOut | None


class SpeakingReviewDetail(SpeakingResult):
    student_id: int
    student_name: str
    student_email: str
