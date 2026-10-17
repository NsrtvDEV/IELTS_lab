"""Схемы для учителя: создание тестов и их содержимого."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models import QuestionType, SectionType
from app.schemas.writing import WritingTaskOut

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)]
NonEmpty = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
AnswerText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]

# ───────────────────────── Tests ─────────────────────────


class TestCreate(BaseModel):
    __test__ = False
    title: Title


class TestUpdate(BaseModel):
    __test__ = False
    title: Title


class SectionUpdate(BaseModel):
    duration_min: int = Field(ge=1, le=180)


class TeacherSection(BaseModel):
    id: int
    type: SectionType
    duration_min: int
    question_count: int = 0


class TeacherTest(BaseModel):
    __test__ = False

    id: int
    title: str
    is_published: bool
    created_at: datetime
    updated_at: datetime
    sections: list[TeacherSection]
    has_attempts: bool
    problems: list[str]  # что мешает публикации; пусто — можно публиковать


# ───────────────────────── Passages ─────────────────────────


class PassageCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)] | None = None
    text: str | None = None  # Reading — текст
    audio_url: str | None = Field(default=None, max_length=500)  # Listening — аудио части
    position: int = Field(default=0, ge=0)


class PassageUpdate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)] | None = None
    text: str | None = None
    audio_url: str | None = Field(default=None, max_length=500)
    position: int | None = Field(default=None, ge=0)


class TeacherPassage(BaseModel):
    id: int
    title: str | None
    text: str | None
    audio_url: str | None
    audio_duration_sec: int | None = None
    position: int

    model_config = ConfigDict(from_attributes=True)


# ───────────────────────── Question groups ─────────────────────────


class OptionIn(BaseModel):
    label: Label  # "A", "B", "iv"
    text: NonEmpty


class QuestionIn(BaseModel):
    number: int = Field(ge=1, le=40)  # сквозной номер в секции
    text: str | None = None
    answers_required: int = Field(default=1, ge=1, le=5)  # "Choose TWO" → 2
    points: int | None = Field(default=None, ge=1, le=5)  # по умолчанию = answers_required
    meta: dict | None = None
    options: list[OptionIn] = []  # свои варианты вопроса (MCQ)
    # правильный ответ — либо буквы вариантов, либо допустимые тексты
    correct_options: list[Label] = []
    correct_texts: list[AnswerText] = []


class QuestionGroupCreate(BaseModel):
    passage_id: int | None = None
    type: QuestionType
    instruction: NonEmpty  # "Questions 1–5. Write NO MORE THAN TWO WORDS"
    word_limit: int | None = Field(default=None, ge=1, le=10)
    allow_number: bool = False  # "... AND/OR A NUMBER"
    position: int = Field(default=0, ge=0)
    image_url: str | None = Field(default=None, max_length=500)  # схема / карта / таблица
    meta: dict | None = None
    # общие варианты группы (заголовки для matching); для TFNG/YNNG создаются сами
    options: list[OptionIn] = []
    questions: list[QuestionIn] = Field(min_length=1)


class TeacherOption(BaseModel):
    id: int
    label: str
    text: str

    model_config = ConfigDict(from_attributes=True)


class TeacherQuestion(BaseModel):
    id: int
    number: int
    text: str | None
    answers_required: int
    points: int
    meta: dict | None
    options: list[TeacherOption]
    correct_options: list[str]
    correct_texts: list[str]


class TeacherQuestionGroup(BaseModel):
    id: int
    passage_id: int | None
    type: QuestionType
    instruction: str
    word_limit: int | None
    allow_number: bool
    position: int
    image_url: str | None
    meta: dict | None
    options: list[TeacherOption]
    questions: list[TeacherQuestion]


class TeacherSectionContent(BaseModel):
    """Секция глазами учителя — вместе с правильными ответами."""

    id: int
    test_id: int
    type: SectionType
    duration_min: int
    passages: list[TeacherPassage]
    question_groups: list[TeacherQuestionGroup]
    question_numbers: list[int]  # занятые номера — удобно для следующей группы
    writing_tasks: list[WritingTaskOut] = []  # Writing: Task 1 и Task 2
