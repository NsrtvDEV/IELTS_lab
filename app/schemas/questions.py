"""Схемы секций с вопросами — общие для Reading и Listening."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import QuestionType, SectionType

# ───────────────────────── Content ─────────────────────────


class OptionResponse(BaseModel):
    id: int
    label: str
    text: str

    model_config = ConfigDict(from_attributes=True)


class QuestionResponse(BaseModel):
    id: int
    number: int
    text: str | None = None
    answers_required: int
    meta: dict | None = None
    options: list[OptionResponse]

    model_config = ConfigDict(from_attributes=True)


class QuestionGroupResponse(BaseModel):
    id: int
    passage_id: int | None = None
    type: QuestionType
    instruction: str
    word_limit: int | None = None
    allow_number: bool
    image_url: str | None = None
    meta: dict | None = None
    options: list[OptionResponse]  # общий список для matching
    questions: list[QuestionResponse]

    model_config = ConfigDict(from_attributes=True)


class PassageResponse(BaseModel):
    """Reading — текст (text); Listening — аудио части (audio_url)."""

    id: int
    title: str | None = None
    text: str | None = None
    audio_url: str | None = None
    position: int

    model_config = ConfigDict(from_attributes=True)


class SavedAnswer(BaseModel):
    question_id: int
    answer_text: str | None = None
    option_ids: list[int] = []


class QuestionSectionContent(BaseModel):
    """Содержимое секции для прохождения — без правильных ответов."""

    section_attempt_id: int
    attempt_id: int  # для выхода из теста (abandon)
    section_type: SectionType
    deadline: datetime
    passages: list[PassageResponse]
    question_groups: list[QuestionGroupResponse]
    answers: list[SavedAnswer]  # уже сохранённое — для продолжения после обрыва связи


# ───────────────────────── Answers ─────────────────────────


class AnswerIn(BaseModel):
    question_id: int
    answer_text: str | None = Field(default=None, max_length=500)
    option_ids: list[int] = []


class AnswersSave(BaseModel):
    answers: list[AnswerIn]


# ───────────────────────── Result ─────────────────────────


class QuestionResult(BaseModel):
    question_id: int
    number: int
    type: QuestionType
    passage_id: int | None = None  # к какому тексту/части относится вопрос
    your_answer: str | None = None
    correct_answers: list[str]
    earned: int
    points: int


class QuestionSectionResult(BaseModel):
    section_attempt_id: int
    attempt_id: int
    test_title: str
    section_type: SectionType
    submitted_at: datetime | None = None
    raw_score: int | None = None  # сумма баллов ("Choose TWO" стоит 2 балла)
    max_score: int  # сколько баллов можно было набрать
    correct_count: int  # вопросов отвечено полностью верно
    question_count: int
    band_score: Decimal | None = None
    time_spent_sec: int | None = None
    questions: list[QuestionResult]
