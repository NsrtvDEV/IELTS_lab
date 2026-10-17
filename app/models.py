import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import expression

from app.database import Base

# ───────────────────────── Helpers ─────────────────────────


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """PostgreSQL ENUM: в БД хранятся значения (student), а не имена (STUDENT)."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


def band_check(column: str) -> CheckConstraint:
    """Band IELTS: от 0 до 9 с шагом 0.5 (NULL допустим)."""
    return CheckConstraint(
        f"{column} >= 0 AND {column} <= 9 AND {column} * 2 = floor({column} * 2)",
        name=f"{column}_range",
    )


def criterion_check(column: str) -> CheckConstraint:
    """Оценка по критерию Writing/Speaking — целое число от 0 до 9."""
    return CheckConstraint(f"{column} BETWEEN 0 AND 9", name=f"{column}_range")


# ───────────────────────── Enums ─────────────────────────


class UserRole(enum.StrEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class SectionType(enum.StrEnum):
    LISTENING = "listening"
    READING = "reading"
    WRITING = "writing"
    SPEAKING = "speaking"


class QuestionType(enum.StrEnum):
    MCQ = "mcq"  # один вариант
    MCQ_MULTI = "mcq_multi"  # "Choose TWO letters, A–E"
    TFNG = "tfng"  # True / False / Not Given
    YNNG = "ynng"  # Yes / No / Not Given
    MATCHING_HEADINGS = "matching_headings"
    MATCHING_INFO = "matching_info"
    MATCHING_FEATURES = "matching_features"
    MATCHING_SENTENCE_ENDINGS = "matching_sentence_endings"
    SENTENCE_COMPLETION = "sentence_completion"
    SUMMARY_COMPLETION = "summary_completion"
    NOTE_COMPLETION = "note_completion"
    FORM_COMPLETION = "form_completion"
    TABLE_COMPLETION = "table_completion"
    FLOW_CHART_COMPLETION = "flow_chart_completion"
    GAP_FILL = "gap_fill"
    SHORT_ANSWER = "short_answer"
    DIAGRAM_LABEL = "diagram_label"
    MAP_LABEL = "map_label"  # Listening: map / plan labelling


class AttemptStatus(enum.StrEnum):
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"  # Writing/Speaking ждут оценки
    FINISHED = "finished"
    ABANDONED = "abandoned"


class GraderType(enum.StrEnum):
    TEACHER = "teacher"
    AI = "ai"


# Один объект на тип — чтобы Alembic не пытался создать один ENUM дважды
USER_ROLE = pg_enum(UserRole, "user_role")
SECTION_TYPE = pg_enum(SectionType, "section_type")
QUESTION_TYPE = pg_enum(QuestionType, "question_type")
ATTEMPT_STATUS = pg_enum(AttemptStatus, "attempt_status")
GRADER_TYPE = pg_enum(GraderType, "grader_type")


# ───────────────────────── Users ─────────────────────────


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        USER_ROLE,
        default=UserRole.STUDENT,
        server_default=UserRole.STUDENT.value,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=expression.true()
    )

    profile: Mapped["UserProfile | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="raise"
    )
    attempts: Mapped[list["TestAttempt"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="raise"
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    native_language: Mapped[str | None] = mapped_column(String(50))
    timezone: Mapped[str] = mapped_column(
        String(64), default="UTC", server_default="UTC"
    )

    user: Mapped["User"] = relationship(back_populates="profile")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=expression.false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


# ───────────────────────── Test content ─────────────────────────


class IeltsTest(TimestampMixin, Base):
    """Mock-экзамен IELTS Academic: Listening, Reading, Writing, Speaking.

    Таблица `tests` (класс назван IeltsTest, чтобы не конфликтовать с pytest).
    """

    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=expression.false()
    )

    sections: Mapped[list["Section"]] = relationship(
        back_populates="test",
        cascade="all, delete-orphan",
        order_by="Section.position",
        lazy="selectin",
    )


class Section(Base):
    __tablename__ = "sections"
    __table_args__ = (UniqueConstraint("test_id", "type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    test_id: Mapped[int] = mapped_column(
        ForeignKey("tests.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[SectionType] = mapped_column(SECTION_TYPE)
    duration_min: Mapped[int] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    test: Mapped["IeltsTest"] = relationship(back_populates="sections")
    passages: Mapped[list["Passage"]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="Passage.position",
        lazy="raise",
    )
    question_groups: Mapped[list["QuestionGroup"]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="QuestionGroup.position",
        lazy="raise",
    )
    writing_tasks: Mapped[list["WritingTask"]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="WritingTask.task_number",
        lazy="raise",
    )
    speaking_tasks: Mapped[list["SpeakingTask"]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="[SpeakingTask.part, SpeakingTask.position]",
        lazy="raise",
    )


class Passage(Base):
    """Текст для Reading (Passage 1–3) или аудио для Listening (Part 1–4)."""

    __tablename__ = "passages"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str | None] = mapped_column(String(255))
    text: Mapped[str | None] = mapped_column(Text)
    audio_url: Mapped[str | None] = mapped_column(String(500))  # файл в S3/MinIO
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    section: Mapped["Section"] = relationship(back_populates="passages")
    question_groups: Mapped[list["QuestionGroup"]] = relationship(
        back_populates="passage", lazy="raise"
    )


class QuestionGroup(Base):
    """Блок вопросов с общей инструкцией: "Questions 1–5. Write NO MORE THAN TWO WORDS"."""

    __tablename__ = "question_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE"), index=True
    )
    passage_id: Mapped[int | None] = mapped_column(
        ForeignKey("passages.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[QuestionType] = mapped_column(QUESTION_TYPE)
    instruction: Mapped[str] = mapped_column(Text)
    # лимит слов для completion-заданий ("NO MORE THAN TWO WORDS" → 2)
    word_limit: Mapped[int | None] = mapped_column(SmallInteger)
    allow_number: Mapped[bool] = mapped_column(  # "... AND/OR A NUMBER"
        Boolean, default=False, server_default=expression.false()
    )
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # схема, карта, таблица или flow-chart к вопросам группы
    image_url: Mapped[str | None] = mapped_column(String(500))
    meta: Mapped[dict | None] = mapped_column(JSONB)

    section: Mapped["Section"] = relationship(back_populates="question_groups")
    passage: Mapped["Passage | None"] = relationship(back_populates="question_groups")
    questions: Mapped[list["Question"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="Question.number",
        lazy="selectin",
    )
    # общий список вариантов для matching (заголовки i–x, A–G и т.п.)
    options: Mapped[list["QuestionOption"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="QuestionOption.position",
        lazy="selectin",
    )


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        CheckConstraint("answers_required >= 1", name="answers_required_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("question_groups.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column(SmallInteger)  # сквозной номер в секции, 1–40
    text: Mapped[str | None] = mapped_column(Text)  # у пропуска в summary может не быть
    # сколько вариантов нужно выбрать (MCQ_MULTI: "Choose TWO" → 2)
    answers_required: Mapped[int] = mapped_column(
        SmallInteger, default=1, server_default="1"
    )
    points: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    meta: Mapped[dict | None] = mapped_column(JSONB)

    group: Mapped["QuestionGroup"] = relationship(back_populates="questions")
    options: Mapped[list["QuestionOption"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.position",
        lazy="selectin",
    )
    correct_answers: Mapped[list["CorrectAnswer"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", lazy="raise"
    )


class QuestionOption(Base):
    """Вариант ответа: свой у вопроса (MCQ) или общий у группы (matching)."""

    __tablename__ = "question_options"
    __table_args__ = (
        CheckConstraint(
            "(question_id IS NULL) <> (group_id IS NULL)", name="single_owner"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_groups.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(10))  # "A", "B", "iv"
    text: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    question: Mapped["Question | None"] = relationship(back_populates="options")
    group: Mapped["QuestionGroup | None"] = relationship(back_populates="options")


class CorrectAnswer(Base):
    """Правильный ответ на вопрос — единственный источник правды при проверке.

    Варианты (option_id): засчитываются все строки вместе (MCQ_MULTI — их несколько).
    Текст (answer_text): любая из строк — допустимые написания ("colour" / "color").
    """

    __tablename__ = "correct_answers"
    __table_args__ = (
        CheckConstraint(
            "(option_id IS NULL) <> (answer_text IS NULL)", name="single_kind"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    option_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_options.id", ondelete="CASCADE")
    )
    answer_text: Mapped[str | None] = mapped_column(String(255))

    question: Mapped["Question"] = relationship(back_populates="correct_answers")
    option: Mapped["QuestionOption | None"] = relationship()


class WritingTask(Base):
    """Writing Task 1 (график/письмо, 150+ слов) и Task 2 (эссе, 250+ слов)."""

    __tablename__ = "writing_tasks"
    __table_args__ = (
        UniqueConstraint("section_id", "task_number"),
        CheckConstraint("task_number IN (1, 2)", name="task_number_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE")
    )
    task_number: Mapped[int] = mapped_column(SmallInteger)
    prompt: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))  # график/диаграмма для Task 1
    min_words: Mapped[int] = mapped_column(SmallInteger)
    recommended_min: Mapped[int] = mapped_column(SmallInteger)  # 20 / 40 минут

    section: Mapped["Section"] = relationship(back_populates="writing_tasks")


class SpeakingTask(Base):
    """Speaking Part 1 (интервью), Part 2 (карточка), Part 3 (дискуссия)."""

    __tablename__ = "speaking_tasks"
    __table_args__ = (CheckConstraint("part IN (1, 2, 3)", name="part_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE"), index=True
    )
    part: Mapped[int] = mapped_column(SmallInteger)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    prompt: Mapped[str] = mapped_column(Text)  # вопрос или тема карточки
    # пункты карточки Part 2: ["what it is", "when you ...", ...]
    cue_card_points: Mapped[list | None] = mapped_column(JSONB)
    prep_time_sec: Mapped[int | None] = mapped_column(Integer)  # Part 2: 60
    speak_time_sec: Mapped[int | None] = mapped_column(Integer)  # Part 2: до 120

    section: Mapped["Section"] = relationship(back_populates="speaking_tasks")


# ───────────────────────── Attempts ─────────────────────────


class TestAttempt(Base):
    """Попытка: весь mock-экзамен или одна его секция."""

    __test__ = False
    __tablename__ = "test_attempts"
    __table_args__ = (
        band_check("overall_band"),
        # overall band считается только для полного экзамена
        CheckConstraint(
            "section_type IS NULL OR overall_band IS NULL",
            name="overall_band_full_only",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    test_id: Mapped[int] = mapped_column(
        ForeignKey("tests.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[AttemptStatus] = mapped_column(
        ATTEMPT_STATUS,
        default=AttemptStatus.IN_PROGRESS,
        server_default=AttemptStatus.IN_PROGRESS.value,
    )
    # NULL — полный экзамен (4 секции подряд), иначе — только эта секция
    section_type: Mapped[SectionType | None] = mapped_column(SECTION_TYPE)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    overall_band: Mapped[Decimal | None] = mapped_column(Numeric(2, 1))

    user: Mapped["User"] = relationship(back_populates="attempts")
    test: Mapped["IeltsTest"] = relationship(lazy="joined")
    section_attempts: Mapped[list["SectionAttempt"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", lazy="selectin"
    )


class SectionAttempt(Base):
    __tablename__ = "section_attempts"
    __table_args__ = (
        UniqueConstraint("attempt_id", "section_id"),
        band_check("band_score"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="CASCADE"), index=True
    )
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="RESTRICT")
    )
    # таймер секции считается по серверному времени
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw_score: Mapped[int | None] = mapped_column(Integer)  # только Listening/Reading
    band_score: Mapped[Decimal | None] = mapped_column(Numeric(2, 1))
    time_spent_sec: Mapped[int | None] = mapped_column(Integer)

    attempt: Mapped["TestAttempt"] = relationship(
        back_populates="section_attempts", lazy="joined"
    )
    section: Mapped["Section"] = relationship(lazy="joined")
    answers: Mapped[list["UserAnswer"]] = relationship(
        back_populates="section_attempt", cascade="all, delete-orphan", lazy="raise"
    )
    writing_responses: Mapped[list["WritingResponse"]] = relationship(
        back_populates="section_attempt", cascade="all, delete-orphan", lazy="raise"
    )
    speaking_responses: Mapped[list["SpeakingResponse"]] = relationship(
        back_populates="section_attempt", cascade="all, delete-orphan", lazy="raise"
    )
    speaking_assessments: Mapped[list["SpeakingAssessment"]] = relationship(
        back_populates="section_attempt", cascade="all, delete-orphan", lazy="raise"
    )


class UserAnswer(Base):
    __tablename__ = "user_answers"
    # один ответ на вопрос в секции; индекс по section_attempt_id покрыт этим констрейнтом
    __table_args__ = (UniqueConstraint("section_attempt_id", "question_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    section_attempt_id: Mapped[int] = mapped_column(
        ForeignKey("section_attempts.id", ondelete="CASCADE")
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="RESTRICT"), index=True
    )
    answer_text: Mapped[str | None] = mapped_column(Text)  # completion / short answer
    is_correct: Mapped[bool | None] = mapped_column(Boolean)  # NULL = ещё не проверено

    section_attempt: Mapped["SectionAttempt"] = relationship(back_populates="answers")
    selected_options: Mapped[list["UserAnswerOption"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class UserAnswerOption(Base):
    """Выбранные варианты (для MCQ_MULTI их несколько)."""

    __tablename__ = "user_answer_options"

    user_answer_id: Mapped[int] = mapped_column(
        ForeignKey("user_answers.id", ondelete="CASCADE"), primary_key=True
    )
    option_id: Mapped[int] = mapped_column(
        ForeignKey("question_options.id", ondelete="RESTRICT"), primary_key=True
    )

    option: Mapped["QuestionOption"] = relationship(lazy="joined")


class WritingResponse(Base):
    __tablename__ = "writing_responses"
    __table_args__ = (UniqueConstraint("section_attempt_id", "task_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    section_attempt_id: Mapped[int] = mapped_column(
        ForeignKey("section_attempts.id", ondelete="CASCADE")
    )
    task_id: Mapped[int] = mapped_column(
        ForeignKey("writing_tasks.id", ondelete="RESTRICT"), index=True
    )
    text: Mapped[str] = mapped_column(Text, default="", server_default="")
    word_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    section_attempt: Mapped["SectionAttempt"] = relationship(
        back_populates="writing_responses"
    )
    task: Mapped["WritingTask"] = relationship(lazy="joined")
    assessments: Mapped[list["WritingAssessment"]] = relationship(
        back_populates="response", cascade="all, delete-orphan", lazy="raise"
    )


class SpeakingResponse(Base):
    __tablename__ = "speaking_responses"
    __table_args__ = (UniqueConstraint("section_attempt_id", "task_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    section_attempt_id: Mapped[int] = mapped_column(
        ForeignKey("section_attempts.id", ondelete="CASCADE")
    )
    task_id: Mapped[int] = mapped_column(
        ForeignKey("speaking_tasks.id", ondelete="RESTRICT"), index=True
    )
    audio_url: Mapped[str | None] = mapped_column(String(500))
    transcript: Mapped[str | None] = mapped_column(Text)
    duration_sec: Mapped[int | None] = mapped_column(Integer)

    section_attempt: Mapped["SectionAttempt"] = relationship(
        back_populates="speaking_responses"
    )
    task: Mapped["SpeakingTask"] = relationship(lazy="joined")


class WritingAssessment(Base):
    """Оценка одного Writing Task по 4 критериям (Task 2 весит вдвое больше Task 1)."""

    __tablename__ = "writing_assessments"
    __table_args__ = (
        criterion_check("task_response"),
        criterion_check("coherence_cohesion"),
        criterion_check("lexical_resource"),
        criterion_check("grammatical_range"),
        band_check("band"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(
        ForeignKey("writing_responses.id", ondelete="CASCADE"), index=True
    )
    grader_type: Mapped[GraderType] = mapped_column(GRADER_TYPE)
    grader_id: Mapped[int | None] = mapped_column(  # преподаватель; NULL для AI
        ForeignKey("users.id", ondelete="SET NULL")
    )
    task_response: Mapped[int] = mapped_column(SmallInteger)  # TA для Task 1, TR для Task 2
    coherence_cohesion: Mapped[int] = mapped_column(SmallInteger)
    lexical_resource: Mapped[int] = mapped_column(SmallInteger)
    grammatical_range: Mapped[int] = mapped_column(SmallInteger)
    band: Mapped[Decimal] = mapped_column(Numeric(2, 1))
    feedback: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    response: Mapped["WritingResponse"] = relationship(back_populates="assessments")


class SpeakingAssessment(Base):
    """Оценка всей Speaking-секции по 4 критериям."""

    __tablename__ = "speaking_assessments"
    __table_args__ = (
        criterion_check("fluency_coherence"),
        criterion_check("lexical_resource"),
        criterion_check("grammatical_range"),
        criterion_check("pronunciation"),
        band_check("band"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    section_attempt_id: Mapped[int] = mapped_column(
        ForeignKey("section_attempts.id", ondelete="CASCADE"), index=True
    )
    grader_type: Mapped[GraderType] = mapped_column(GRADER_TYPE)
    grader_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    fluency_coherence: Mapped[int] = mapped_column(SmallInteger)
    lexical_resource: Mapped[int] = mapped_column(SmallInteger)
    grammatical_range: Mapped[int] = mapped_column(SmallInteger)
    pronunciation: Mapped[int] = mapped_column(SmallInteger)
    band: Mapped[Decimal] = mapped_column(Numeric(2, 1))
    feedback: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    section_attempt: Mapped["SectionAttempt"] = relationship(
        back_populates="speaking_assessments"
    )


class BandConversion(Base):
    """Перевод сырых баллов (0–40) в band для Listening и Reading (Academic)."""

    __tablename__ = "band_conversion"
    __table_args__ = (
        UniqueConstraint("section_type", "raw_score"),
        CheckConstraint("raw_score BETWEEN 0 AND 40", name="raw_score_range"),
        CheckConstraint(
            "section_type IN ('listening', 'reading')", name="section_type_scored"
        ),
        band_check("band"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    section_type: Mapped[SectionType] = mapped_column(SECTION_TYPE)
    raw_score: Mapped[int] = mapped_column(Integer)
    band: Mapped[Decimal] = mapped_column(Numeric(2, 1))
