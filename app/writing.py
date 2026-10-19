"""Writing: содержимое секции, черновики, результат и оценка преподавателем."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    SectionAttempt,
    User,
    UserProfile,
    WritingAssessment,
    WritingResponse,
    WritingTask,
)
from app.schemas.writing import (
    AssessmentOut,
    InlineComment,
    WritingAssessmentIn,
    WritingContent,
    WritingDraft,
    WritingResult,
    WritingTaskOut,
    WritingTaskResult,
)
from app import notifications
from app.scoring import criteria_band, section_deadline, update_attempt_status, writing_band
from app.utils import count_words


async def section_tasks(session: AsyncSession, section_id: int) -> list[WritingTask]:
    return list(
        await session.scalars(
            select(WritingTask).where(WritingTask.section_id == section_id).order_by(WritingTask.task_number)
        )
    )


async def responses_by_task(session: AsyncSession, sa_id: int) -> dict[int, WritingResponse]:
    rows = await session.scalars(
        select(WritingResponse)
        .where(WritingResponse.section_attempt_id == sa_id)
        .options(selectinload(WritingResponse.assessments))
    )
    return {r.task_id: r for r in rows}


async def writing_content(session: AsyncSession, sa: SectionAttempt) -> WritingContent:
    tasks = await section_tasks(session, sa.section_id)
    responses = await responses_by_task(session, sa.id)
    return WritingContent(
        section_attempt_id=sa.id,
        attempt_id=sa.attempt_id,
        deadline=section_deadline(sa),
        tasks=[WritingTaskOut.model_validate(t) for t in tasks],
        responses=[WritingDraft(task_id=r.task_id, text=r.text, word_count=r.word_count) for r in responses.values()],
    )


async def save_draft(session: AsyncSession, sa: SectionAttempt, task_id: int, text: str) -> WritingDraft:
    task = await session.get(WritingTask, task_id)
    if not task or task.section_id != sa.section_id:
        raise HTTPException(status_code=404, detail="Writing task not found")
    response = await session.scalar(
        select(WritingResponse).where(
            WritingResponse.section_attempt_id == sa.id, WritingResponse.task_id == task.id
        )
    )
    if response is None:
        response = WritingResponse(section_attempt_id=sa.id, task_id=task.id)
        session.add(response)
    response.text = text
    response.word_count = count_words(text)
    await session.commit()
    return WritingDraft(task_id=task.id, text=response.text, word_count=response.word_count)


def latest_teacher_assessment(response: WritingResponse) -> WritingAssessment | None:
    """Действует последняя оценка: повторная оценка заменяет прежнюю."""
    return max(response.assessments, key=lambda a: (a.created_at, a.id), default=None)


async def grader_names(session: AsyncSession, ids: set[int]) -> dict[int, str]:
    if not ids:
        return {}
    rows = await session.execute(
        select(User.id, User.email, UserProfile.first_name, UserProfile.last_name)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id.in_(ids))
    )
    return {r.id: " ".join(p for p in (r.first_name, r.last_name) if p) or r.email for r in rows}


async def writing_result(session: AsyncSession, sa: SectionAttempt) -> WritingResult:
    if not sa.submitted_at:
        raise HTTPException(status_code=409, detail="Section is not submitted yet")
    tasks = await section_tasks(session, sa.section_id)
    responses = await responses_by_task(session, sa.id)
    latest = {t.id: latest_teacher_assessment(responses[t.id]) if t.id in responses else None for t in tasks}
    names = await grader_names(session, {a.grader_id for a in latest.values() if a and a.grader_id})

    def assessment_out(a: WritingAssessment | None) -> AssessmentOut | None:
        if a is None:
            return None
        return AssessmentOut(
            task_response=a.task_response,
            coherence_cohesion=a.coherence_cohesion,
            lexical_resource=a.lexical_resource,
            grammatical_range=a.grammatical_range,
            band=a.band,
            feedback=a.feedback,
            comments=[InlineComment(**c) for c in a.comments or []],
            grader_name=names.get(a.grader_id),
            created_at=a.created_at,
        )

    return WritingResult(
        section_attempt_id=sa.id,
        attempt_id=sa.attempt_id,
        test_title=sa.attempt.test.title,
        submitted_at=sa.submitted_at,
        time_spent_sec=sa.time_spent_sec,
        band_score=sa.band_score,
        status="assessed" if sa.band_score is not None else "pending",
        tasks=[
            WritingTaskResult(
                task_id=t.id,
                task_number=t.task_number,
                prompt=t.prompt,
                image_url=t.image_url,
                min_words=t.min_words,
                text=responses[t.id].text if t.id in responses else "",
                word_count=responses[t.id].word_count if t.id in responses else 0,
                assessment=assessment_out(latest[t.id]),
            )
            for t in tasks
        ],
    )


def checked_comments(text: str, comments: list[InlineComment], task_number: int) -> list[dict]:
    """Фрагменты должны совпадать с текстом эссе и не пересекаться."""
    ordered = sorted(comments, key=lambda c: c.start)
    for i, c in enumerate(ordered):
        if c.end > len(text) or c.start >= c.end or text[c.start:c.end] != c.quote:
            raise HTTPException(status_code=400, detail=f"Task {task_number}: a comment doesn't match the essay text")
        if i and c.start < ordered[i - 1].end:
            raise HTTPException(status_code=400, detail=f"Task {task_number}: commented fragments overlap")
    return [c.model_dump() for c in ordered]


async def assess(session: AsyncSession, sa: SectionAttempt, teacher: User, data: WritingAssessmentIn) -> None:
    """Оценка преподавателем: все задания секции сразу; повторная оценка заменяет прежнюю."""
    tasks = await section_tasks(session, sa.section_id)
    responses = await responses_by_task(session, sa.id)
    given = {t.task_id: t for t in data.tasks}
    if set(given) != {t.id for t in tasks}:
        raise HTTPException(status_code=400, detail="Assess every task of the section")

    updated = sa.band_score is not None  # уже оценивали — ученику «оценка изменена»
    task_bands = {}
    for task in tasks:
        scores = given[task.id]
        band = criteria_band(
            scores.task_response, scores.coherence_cohesion, scores.lexical_resource, scores.grammatical_range
        )
        session.add(
            WritingAssessment(
                response_id=responses[task.id].id,
                grader_id=teacher.id,
                task_response=scores.task_response,
                coherence_cohesion=scores.coherence_cohesion,
                lexical_resource=scores.lexical_resource,
                grammatical_range=scores.grammatical_range,
                band=band,
                feedback=scores.feedback or None,
                comments=checked_comments(responses[task.id].text, scores.comments, task.task_number) or None,
            )
        )
        task_bands[task.task_number] = band

    sa.band_score = writing_band(task_bands)
    await update_attempt_status(session, sa.attempt)
    await notifications.work_assessed(session, sa, updated=updated)
    await session.commit()
