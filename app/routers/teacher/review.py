"""Проверка Writing преподавателем: очередь работ, разбор, оценка по критериям."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.database import db_dep
from app.dependencies import teacher_dep
from app.models import (
    AttemptStatus,
    IeltsTest,
    Section,
    SectionAttempt,
    SectionType,
    TestAttempt,
    User,
    UserProfile,
    WritingResponse,
    WritingTask,
)
from app.routers.teacher.dashboard import display_name
from app.schemas.writing import ReviewDetail, ReviewItem, WritingAssessmentIn
from app.writing import assess, writing_result

router = APIRouter(prefix="/teacher/review", tags=["Teacher: review"])


@router.get("", response_model=list[ReviewItem])
async def review_queue(
    session: db_dep, teacher: teacher_dep, status: Literal["pending", "assessed", "all"] = "pending"
):
    """Сданные работы Writing: сначала самые давние (их ждут дольше всех)."""
    stmt = (
        select(SectionAttempt, TestAttempt.user_id, TestAttempt.section_type, IeltsTest.title,
               User.email, UserProfile.first_name, UserProfile.last_name)
        .join(SectionAttempt.attempt)
        .join(SectionAttempt.section)
        .join(TestAttempt.test)
        .join(User, User.id == TestAttempt.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(
            Section.type == SectionType.WRITING,
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

    counts: dict[int, list[int]] = {}
    if rows:
        wc = await session.execute(
            select(WritingResponse.section_attempt_id, WritingResponse.word_count)
            .join(WritingTask, WritingTask.id == WritingResponse.task_id)
            .where(WritingResponse.section_attempt_id.in_([r[0].id for r in rows]))
            .order_by(WritingTask.task_number)
        )
        for sa_id, words in wc.all():
            counts.setdefault(sa_id, []).append(words)

    return [
        ReviewItem(
            section_attempt_id=sa.id,
            student_id=user_id,
            student_name=display_name(first, last, email),
            student_email=email,
            test_title=title,
            mode="section" if section_type else "mock",
            submitted_at=sa.submitted_at,
            word_counts=counts.get(sa.id, []),
            band_score=sa.band_score,
        )
        for sa, user_id, section_type, title, email, first, last in rows
    ]


async def submitted_writing(session, sa_id: int) -> SectionAttempt:
    sa = await session.get(SectionAttempt, sa_id)
    if not sa or sa.section.type != SectionType.WRITING:
        raise HTTPException(status_code=404, detail="Writing work not found")
    if not sa.submitted_at:
        raise HTTPException(status_code=409, detail="The student hasn't submitted this work yet")
    if sa.attempt.status == AttemptStatus.ABANDONED:
        raise HTTPException(status_code=409, detail="The attempt was abandoned")
    return sa


@router.get("/writing/{section_attempt_id}", response_model=ReviewDetail)
async def review_detail(section_attempt_id: int, session: db_dep, teacher: teacher_dep):
    sa = await submitted_writing(session, section_attempt_id)
    student = await session.get(User, sa.attempt.user_id)
    profile = await session.get(UserProfile, student.id)
    result = await writing_result(session, sa)
    return ReviewDetail(
        **result.model_dump(),
        student_id=student.id,
        student_name=display_name(profile.first_name if profile else None, profile.last_name if profile else None, student.email),
        student_email=student.email,
    )


@router.post("/writing/{section_attempt_id}", response_model=ReviewDetail)
async def assess_writing(
    section_attempt_id: int, session: db_dep, teacher: teacher_dep, data: WritingAssessmentIn
):
    """Оценить оба задания: 4 критерия 0–9 и отзыв; band считается автоматически."""
    sa = await submitted_writing(session, section_attempt_id)
    await assess(session, sa, teacher, data)
    return await review_detail(section_attempt_id, session, teacher)
