"""Проверка Writing и Speaking преподавателем: очередь работ, разбор, оценка по критериям."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app import speaking, writing
from app.database import db_dep
from app.dependencies import teacher_dep
from app.models import (
    AttemptStatus,
    IeltsTest,
    Section,
    SectionAttempt,
    SectionType,
    SpeakingResponse,
    SpeakingTask,
    TestAttempt,
    User,
    UserProfile,
    WritingResponse,
    WritingTask,
)
from app.routers.teacher.dashboard import display_name
from app.schemas.speaking import SpeakingAssessmentIn, SpeakingReviewDetail
from app.schemas.writing import ReviewDetail, ReviewItem, WritingAssessmentIn

router = APIRouter(prefix="/teacher/review", tags=["Teacher: review"])

REVIEWED = (SectionType.WRITING, SectionType.SPEAKING)


@router.get("", response_model=list[ReviewItem])
async def review_queue(
    session: db_dep,
    teacher: teacher_dep,
    status: Literal["pending", "assessed", "all"] = "pending",
    section: Literal["writing", "speaking"] | None = None,
):
    """Сданные работы Writing и Speaking: сначала самые давние (их ждут дольше всех)."""
    stmt = (
        select(SectionAttempt, Section.type, TestAttempt.user_id, TestAttempt.section_type, IeltsTest.title,
               User.email, UserProfile.first_name, UserProfile.last_name)
        .join(SectionAttempt.attempt)
        .join(SectionAttempt.section)
        .join(TestAttempt.test)
        .join(User, User.id == TestAttempt.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(
            Section.type.in_([SectionType(section)] if section else REVIEWED),
            SectionAttempt.submitted_at.is_not(None),
            TestAttempt.status != AttemptStatus.ABANDONED,
        )
    )
    if status == "pending":
        stmt = stmt.where(SectionAttempt.band_score.is_(None)).order_by(SectionAttempt.submitted_at)
    else:
        if status == "assessed":
            stmt = stmt.where(SectionAttempt.band_score.is_not(None))
        stmt = stmt.order_by(SectionAttempt.submitted_at.desc())
    rows = (await session.execute(stmt)).all()
    ids = [r[0].id for r in rows]

    word_counts: dict[int, list[int]] = {}
    answered: dict[int, int] = {}
    questions: dict[int, int] = {}
    if ids:
        wc = await session.execute(
            select(WritingResponse.section_attempt_id, WritingResponse.word_count)
            .join(WritingTask, WritingTask.id == WritingResponse.task_id)
            .where(WritingResponse.section_attempt_id.in_(ids))
            .order_by(WritingTask.task_number)
        )
        for sa_id, words in wc.all():
            word_counts.setdefault(sa_id, []).append(words)
        answered = dict(
            (
                await session.execute(
                    select(SpeakingResponse.section_attempt_id, func.count())
                    .where(SpeakingResponse.section_attempt_id.in_(ids))
                    .group_by(SpeakingResponse.section_attempt_id)
                )
            ).all()
        )
        speaking_sections = {r[0].section_id for r in rows if r[1] == SectionType.SPEAKING}
        questions = dict(
            (
                await session.execute(
                    select(SpeakingTask.section_id, func.count())
                    .where(SpeakingTask.section_id.in_(speaking_sections))
                    .group_by(SpeakingTask.section_id)
                )
            ).all()
        )

    return [
        ReviewItem(
            section_attempt_id=sa.id,
            section_type=section_type,
            student_id=user_id,
            student_name=display_name(first, last, email),
            student_email=email,
            test_title=title,
            mode="section" if attempt_section else "mock",
            submitted_at=sa.submitted_at,
            word_counts=word_counts.get(sa.id, []),
            answered=answered.get(sa.id, 0) if section_type == SectionType.SPEAKING else None,
            questions=questions.get(sa.section_id, 0) if section_type == SectionType.SPEAKING else None,
            band_score=sa.band_score,
        )
        for sa, section_type, user_id, attempt_section, title, email, first, last in rows
    ]


async def submitted_work(session, sa_id: int, section_type: SectionType) -> SectionAttempt:
    sa = await session.get(SectionAttempt, sa_id)
    if not sa or sa.section.type != section_type:
        raise HTTPException(status_code=404, detail=f"{section_type.capitalize()} work not found")
    if not sa.submitted_at:
        raise HTTPException(status_code=409, detail="The student hasn't submitted this work yet")
    if sa.attempt.status == AttemptStatus.ABANDONED:
        raise HTTPException(status_code=409, detail="The attempt was abandoned")
    return sa


async def student_info(session, sa: SectionAttempt) -> dict:
    student = await session.get(User, sa.attempt.user_id)
    profile = await session.get(UserProfile, student.id)
    return {
        "student_id": student.id,
        "student_name": display_name(
            profile.first_name if profile else None, profile.last_name if profile else None, student.email
        ),
        "student_email": student.email,
    }


# ───────────────────────── Writing ─────────────────────────


@router.get("/writing/{section_attempt_id}", response_model=ReviewDetail)
async def review_writing(section_attempt_id: int, session: db_dep, teacher: teacher_dep):
    sa = await submitted_work(session, section_attempt_id, SectionType.WRITING)
    result = await writing.writing_result(session, sa)
    return ReviewDetail(**result.model_dump(), **await student_info(session, sa))


@router.post("/writing/{section_attempt_id}", response_model=ReviewDetail)
async def assess_writing(
    section_attempt_id: int, session: db_dep, teacher: teacher_dep, data: WritingAssessmentIn
):
    """Оценить оба задания: 4 критерия 0–9 и отзыв; band считается автоматически."""
    sa = await submitted_work(session, section_attempt_id, SectionType.WRITING)
    await writing.assess(session, sa, teacher, data)
    return await review_writing(section_attempt_id, session, teacher)


# ───────────────────────── Speaking ─────────────────────────


@router.get("/speaking/{section_attempt_id}", response_model=SpeakingReviewDetail)
async def review_speaking(section_attempt_id: int, session: db_dep, teacher: teacher_dep):
    """Вопросы с записями ответов; записи — GET /speaking/recordings/{response_id}."""
    sa = await submitted_work(session, section_attempt_id, SectionType.SPEAKING)
    result = await speaking.speaking_result(session, sa)
    return SpeakingReviewDetail(**result.model_dump(), **await student_info(session, sa))


@router.post("/speaking/{section_attempt_id}", response_model=SpeakingReviewDetail)
async def assess_speaking(
    section_attempt_id: int, session: db_dep, teacher: teacher_dep, data: SpeakingAssessmentIn
):
    """Оценить всю секцию: 4 критерия 0–9 и отзыв; band — их среднее."""
    sa = await submitted_work(session, section_attempt_id, SectionType.SPEAKING)
    await speaking.assess(session, sa, teacher, data)
    return await review_speaking(section_attempt_id, session, teacher)
