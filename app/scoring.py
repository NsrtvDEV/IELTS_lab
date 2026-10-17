"""Проверка ответов и подсчёт band по правилам IELTS (разделы 2.6–2.8 TZ.md)."""

from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import (
    AttemptStatus,
    BandConversion,
    Question,
    QuestionGroup,
    QuestionType,
    SectionAttempt,
    SectionType,
    TestAttempt,
    UserAnswer,
)

# порядок секций в полном экзамене
SECTION_ORDER = [
    SectionType.LISTENING,
    SectionType.READING,
    SectionType.WRITING,
    SectionType.SPEAKING,
]
AUTO_GRADED = {SectionType.LISTENING, SectionType.READING}


# ───────────────────────── Band ─────────────────────────


def round_band(value: Decimal) -> Decimal:
    """До ближайших 0.5: 6.25 → 6.5, 6.75 → 7.0, 6.1 → 6.0."""
    return (Decimal(value) * 2).quantize(Decimal(1), rounding=ROUND_HALF_UP) / 2


async def band_from_raw(
    session: AsyncSession, section_type: SectionType, raw: int
) -> Decimal | None:
    """Band по таблице band_conversion: строка с наибольшим raw_score <= raw."""
    return await session.scalar(
        select(BandConversion.band)
        .where(
            BandConversion.section_type == section_type,
            BandConversion.raw_score <= raw,
        )
        .order_by(BandConversion.raw_score.desc())
        .limit(1)
    )


# ───────────────────────── Timer ─────────────────────────


def section_deadline(section_attempt: SectionAttempt) -> datetime:
    return section_attempt.started_at + timedelta(
        minutes=section_attempt.section.duration_min
    )


def is_expired(section_attempt: SectionAttempt) -> bool:
    grace = timedelta(seconds=settings.SECTION_GRACE_SECONDS)
    return datetime.now(UTC) > section_deadline(section_attempt) + grace


# ───────────────────────── Ответы с вопросами (Reading / Listening) ─────────────────────────


def normalize(text: str) -> str:
    return " ".join(text.strip().lower().split())


def within_word_limit(answer: str, group: QuestionGroup) -> bool:
    """"NO MORE THAN TWO WORDS AND/OR A NUMBER": число не считается словом."""
    if group.word_limit is None:
        return True
    tokens = answer.split()
    if group.allow_number:
        numbers = [t for t in tokens if t.replace(",", "").replace(".", "").isdigit()]
        words = len(tokens) - len(numbers)
        return words <= group.word_limit and len(numbers) <= 1
    return len(tokens) <= group.word_limit


def grade_answer(question: Question, answer: UserAnswer | None) -> int:
    """Сколько баллов из question.points заработал ответ.

    Нужны загруженные question.group, question.correct_answers, answer.selected_options.
    """
    if answer is None:
        return 0

    correct_options = {c.option_id for c in question.correct_answers if c.option_id}
    if correct_options:
        selected = {o.option_id for o in answer.selected_options}
        if question.group.type == QuestionType.MCQ_MULTI:
            # "Choose TWO": балл за каждый верный вариант, лишний выбор — ноль
            if len(selected) > question.answers_required:
                return 0
            return min(question.points, len(selected & correct_options))
        return question.points if selected == correct_options else 0

    if not answer.answer_text:
        return 0
    accepted = {normalize(c.answer_text) for c in question.correct_answers if c.answer_text}
    text = normalize(answer.answer_text)
    if text in accepted and within_word_limit(text, question.group):
        return question.points
    return 0


async def load_section_questions(
    session: AsyncSession, section_id: int, *, with_answers: bool = False
) -> list[Question]:
    """Вопросы секции по номерам; правильные ответы — только если with_answers."""
    options = [selectinload(Question.group)]
    if with_answers:
        options.append(selectinload(Question.correct_answers))
    result = await session.scalars(
        select(Question)
        .join(Question.group)
        .where(QuestionGroup.section_id == section_id)
        .options(*options)
        .order_by(Question.number)
    )
    return list(result)


async def load_answers(session: AsyncSession, section_attempt_id: int) -> dict[int, UserAnswer]:
    answers = await session.scalars(
        select(UserAnswer).where(UserAnswer.section_attempt_id == section_attempt_id)
    )
    return {a.question_id: a for a in answers}


async def grade_question_section(session: AsyncSession, section_attempt: SectionAttempt) -> None:
    questions = await load_section_questions(
        session, section_attempt.section_id, with_answers=True
    )
    answers = await load_answers(session, section_attempt.id)

    raw = 0
    for question in questions:
        answer = answers.get(question.id)
        earned = grade_answer(question, answer)
        raw += earned
        if answer is not None:
            answer.is_correct = earned == question.points

    section_attempt.raw_score = raw
    section_attempt.band_score = await band_from_raw(
        session, section_attempt.section.type, raw
    )


# ───────────────────────── Attempt ─────────────────────────


def required_sections(attempt: TestAttempt) -> list[SectionType]:
    if attempt.section_type is not None:
        return [attempt.section_type]
    return SECTION_ORDER


async def update_attempt_status(session: AsyncSession, attempt: TestAttempt) -> None:
    """После сдачи секции или новой оценки: pending_review / finished + overall band."""
    if attempt.status == AttemptStatus.ABANDONED:
        return

    # секцию могли загрузить через sa.attempt — тогда список секций попытки
    # не подгружен (цикл в eager loading); в async подгружаем явно
    await session.flush()
    await session.refresh(attempt, ["section_attempts"])

    by_type = {sa.section.type: sa for sa in attempt.section_attempts}
    needed = [by_type.get(t) for t in required_sections(attempt)]

    if any(sa is None or sa.submitted_at is None for sa in needed):
        attempt.status = AttemptStatus.IN_PROGRESS
        return
    if any(sa.band_score is None for sa in needed):
        attempt.status = AttemptStatus.PENDING_REVIEW
        return

    attempt.status = AttemptStatus.FINISHED
    attempt.finished_at = attempt.finished_at or datetime.now(UTC)
    if attempt.section_type is None:
        attempt.overall_band = round_band(sum(sa.band_score for sa in needed) / len(needed))


async def submit_section(session: AsyncSession, section_attempt: SectionAttempt) -> None:
    """Закрывает секцию: фиксирует время, проверяет ответы, обновляет попытку."""
    if section_attempt.submitted_at is not None:
        return

    # если время вышло, сдачей считается конец таймера, а не момент запроса
    section_attempt.submitted_at = min(datetime.now(UTC), section_deadline(section_attempt))
    section_attempt.time_spent_sec = int(
        (section_attempt.submitted_at - section_attempt.started_at).total_seconds()
    )

    if section_attempt.section.type in AUTO_GRADED:
        await grade_question_section(session, section_attempt)

    await update_attempt_status(session, section_attempt.attempt)
