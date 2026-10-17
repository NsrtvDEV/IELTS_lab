"""Общая логика попыток и секций: доступ, таймер, порядок секций, ответы на вопросы.

Используется роутерами секций (reading, позже listening/writing/speaking).
"""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AttemptStatus,
    CorrectAnswer,
    Passage,
    Question,
    QuestionGroup,
    QuestionType,
    SectionAttempt,
    SectionType,
    TestAttempt,
    User,
    UserAnswer,
    UserAnswerOption,
)
from app.schemas.attempts import AttemptResponse, SectionAttemptShort
from app.schemas.questions import (
    AnswerIn,
    PassageResponse,
    PlaybackState,
    QuestionResult,
    QuestionSectionContent,
    QuestionSectionResult,
    SavedAnswer,
)
from app.scoring import (
    SECTION_ORDER,
    grade_answer,
    is_expired,
    load_answers,
    load_section_questions,
    required_sections,
    section_deadline,
    submit_section,
)

# ───────────────────────── Attempts ─────────────────────────


async def get_own_attempt(session: AsyncSession, attempt_id: int, user: User) -> TestAttempt:
    attempt = await session.get(TestAttempt, attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    await close_expired_sections(session, attempt)
    return attempt


async def close_expired_sections(session: AsyncSession, attempt: TestAttempt) -> None:
    """Секции с истёкшим таймером закрываются при любом обращении к попытке."""
    changed = False
    for sa in attempt.section_attempts:
        if sa.submitted_at is None and is_expired(sa):
            await submit_section(session, sa)
            changed = True
    if changed:
        await session.commit()


def next_section(attempt: TestAttempt) -> SectionType | None:
    if attempt.status != AttemptStatus.IN_PROGRESS:
        return None
    submitted = {sa.section.type for sa in attempt.section_attempts if sa.submitted_at}
    for section_type in required_sections(attempt):
        if section_type not in submitted:
            return section_type
    return None


def short_section(sa: SectionAttempt) -> SectionAttemptShort:
    return SectionAttemptShort(
        id=sa.id,
        section_type=sa.section.type,
        started_at=sa.started_at,
        deadline=section_deadline(sa),
        submitted_at=sa.submitted_at,
        raw_score=sa.raw_score,
        band_score=sa.band_score,
    )


def attempt_response(attempt: TestAttempt) -> AttemptResponse:
    sections = sorted(
        attempt.section_attempts, key=lambda sa: SECTION_ORDER.index(sa.section.type)
    )
    return AttemptResponse(
        id=attempt.id,
        test_id=attempt.test_id,
        test_title=attempt.test.title,
        section_type=attempt.section_type,
        status=attempt.status,
        started_at=attempt.started_at,
        finished_at=attempt.finished_at,
        overall_band=attempt.overall_band,
        sections=[short_section(sa) for sa in sections],
        next_section=next_section(attempt),
    )


# ───────────────────────── Section attempts ─────────────────────────


async def start_section(
    session: AsyncSession, attempt: TestAttempt, section_type: SectionType
) -> SectionAttempt:
    """Начинает секцию или возвращает уже начатую (продолжение после обрыва связи)."""
    existing = next(
        (sa for sa in attempt.section_attempts if sa.section.type == section_type), None
    )
    if existing:
        if existing.submitted_at:
            raise HTTPException(status_code=409, detail="Section already submitted")
        return existing

    allowed = next_section(attempt)
    if allowed != section_type:
        raise HTTPException(status_code=409, detail=f"Now you can start only: {allowed}")

    section = next(s for s in attempt.test.sections if s.type == section_type)
    sa = SectionAttempt(attempt_id=attempt.id, section_id=section.id)
    session.add(sa)
    await session.commit()
    await session.refresh(sa)
    return sa


async def get_own_section_attempt(
    session: AsyncSession, sa_id: int, user: User, section_type: SectionType
) -> SectionAttempt:
    sa = await session.get(SectionAttempt, sa_id)
    if not sa or sa.attempt.user_id != user.id or sa.section.type != section_type:
        raise HTTPException(status_code=404, detail=f"{section_type} section not found")
    return sa


async def get_open_section_attempt(
    session: AsyncSession, sa_id: int, user: User, section_type: SectionType
) -> SectionAttempt:
    """Секция ученика, в которую ещё можно писать ответы."""
    sa = await get_own_section_attempt(session, sa_id, user, section_type)

    if sa.attempt.status != AttemptStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Attempt is not in progress")
    if sa.submitted_at:
        raise HTTPException(status_code=409, detail="Section already submitted")
    if is_expired(sa):
        await submit_section(session, sa)
        await session.commit()
        raise HTTPException(status_code=409, detail="Time is up, section submitted")

    return sa


async def submit(session: AsyncSession, sa: SectionAttempt) -> SectionAttemptShort:
    if sa.attempt.status == AttemptStatus.ABANDONED:
        raise HTTPException(status_code=409, detail="Attempt is abandoned")
    if sa.submitted_at:
        raise HTTPException(status_code=409, detail="Section already submitted")

    await submit_section(session, sa)
    await session.commit()
    return short_section(sa)


# ───────────────────────── Секции с вопросами (Reading / Listening) ─────────────────────────


async def question_section_content(
    session: AsyncSession, sa: SectionAttempt
) -> QuestionSectionContent:
    """Тексты/аудио и вопросы секции — без правильных ответов."""
    passages = await session.scalars(
        select(Passage).where(Passage.section_id == sa.section_id).order_by(Passage.position)
    )
    groups = await session.scalars(
        select(QuestionGroup)
        .where(QuestionGroup.section_id == sa.section_id)
        .order_by(QuestionGroup.position)
    )
    answers = await load_answers(session, sa.id)

    passages = [PassageResponse.model_validate(p) for p in passages]
    if sa.section.type == SectionType.LISTENING:
        # у Listening text — это транскрипт: во время теста он выдал бы ответы
        passages = [p.model_copy(update={"text": None}) for p in passages]

    return QuestionSectionContent(
        section_attempt_id=sa.id,
        attempt_id=sa.attempt_id,
        section_type=sa.section.type,
        deadline=section_deadline(sa),
        playback=sa.playback,
        passages=passages,
        question_groups=list(groups),
        answers=[
            SavedAnswer(
                question_id=a.question_id,
                answer_text=a.answer_text,
                option_ids=[o.option_id for o in a.selected_options],
            )
            for a in answers.values()
        ],
    )


async def save_question_answers(
    session: AsyncSession, sa: SectionAttempt, items: list[AnswerIn]
) -> None:
    """Автосохранение: создаёт или перезаписывает ответы на вопросы секции."""
    questions = {q.id: q for q in await load_section_questions(session, sa.section_id)}
    existing = await load_answers(session, sa.id)

    for item in items:
        question = questions.get(item.question_id)
        if not question:
            raise HTTPException(
                status_code=400, detail=f"Question {item.question_id} is not in this section"
            )

        option_ids = list(dict.fromkeys(item.option_ids))  # без дублей, порядок сохраняем
        allowed = {o.id for o in question.options} | {o.id for o in question.group.options}
        if not set(option_ids) <= allowed:
            raise HTTPException(
                status_code=400, detail=f"Unknown option for question {question.number}"
            )
        limit = question.answers_required if question.group.type == QuestionType.MCQ_MULTI else 1
        if len(option_ids) > limit:
            raise HTTPException(
                status_code=400,
                detail=f"Question {question.number}: choose at most {limit} option(s)",
            )

        answer = existing.get(question.id)
        if answer is None:
            answer = UserAnswer(
                section_attempt_id=sa.id, question_id=question.id, selected_options=[]
            )
            session.add(answer)
        answer.answer_text = item.answer_text
        answer.is_correct = None
        # уже выбранные варианты оставляем, иначе delete+insert одного PK конфликтуют
        current = {o.option_id: o for o in answer.selected_options}
        answer.selected_options = [
            current.get(o) or UserAnswerOption(option_id=o) for o in option_ids
        ]

    await session.commit()


async def save_playback(session: AsyncSession, sa: SectionAttempt, new: PlaybackState) -> PlaybackState:
    """Listening: запоминает, докуда дослушана запись. Назад не откатывается —
    так запись нельзя начать заново из другого браузера или после очистки данных."""
    parts = await session.scalar(select(func.count()).where(Passage.section_id == sa.section_id))
    if new.part >= max(parts, 1):
        raise HTTPException(status_code=400, detail="Unknown part")

    old = PlaybackState(**sa.playback) if sa.playback else PlaybackState(part=0, position=0)
    ahead = (
        not old.finished
        and (new.finished or new.part > old.part or (new.part == old.part and new.position >= old.position))
    )
    if ahead:
        sa.playback = new.model_dump()
        await session.commit()
        return new
    return old


async def question_section_result(
    session: AsyncSession, sa: SectionAttempt
) -> QuestionSectionResult:
    """Разбор сданной секции: ответ ученика, правильный ответ, баллы."""
    if not sa.submitted_at:
        raise HTTPException(status_code=409, detail="Section is not submitted yet")

    questions = await session.scalars(
        select(Question)
        .join(Question.group)
        .where(QuestionGroup.section_id == sa.section_id)
        .options(
            selectinload(Question.group),
            selectinload(Question.correct_answers).selectinload(CorrectAnswer.option),
        )
        .order_by(Question.number)
    )
    answers = await load_answers(session, sa.id)
    # после сдачи — тексты, записи и транскрипты для разбора ошибок
    passages = await session.scalars(
        select(Passage).where(Passage.section_id == sa.section_id).order_by(Passage.position)
    )

    results = []
    for q in questions:
        answer = answers.get(q.id)
        if answer and answer.selected_options:
            your = ", ".join(sorted(o.option.label for o in answer.selected_options))
        else:
            your = answer.answer_text if answer else None

        results.append(
            QuestionResult(
                question_id=q.id,
                number=q.number,
                type=q.group.type,
                passage_id=q.group.passage_id,
                your_answer=your,
                correct_answers=[
                    c.option.label if c.option else c.answer_text for c in q.correct_answers
                ],
                earned=grade_answer(q, answer),
                points=q.points,
            )
        )

    return QuestionSectionResult(
        section_attempt_id=sa.id,
        attempt_id=sa.attempt_id,
        test_title=sa.attempt.test.title,
        section_type=sa.section.type,
        submitted_at=sa.submitted_at,
        raw_score=sa.raw_score,
        max_score=sum(r.points for r in results),
        correct_count=sum(r.earned == r.points for r in results),
        question_count=len(results),
        band_score=sa.band_score,
        time_spent_sec=sa.time_spent_sec,
        questions=results,
        passages=list(passages),
    )
