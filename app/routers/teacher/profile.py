from fastapi import APIRouter
from sqlalchemy import distinct, func, select

from app.database import db_dep
from app.dependencies import teacher_dep
from app.models import (
    AttemptStatus,
    IeltsTest,
    Section,
    SectionAttempt,
    SpeakingAssessment,
    TestAttempt,
    User,
    UserProfile,
    UserRole,
    WritingAssessment,
    WritingResponse,
)
from app.notifications import REVIEWED
from app.routers.teacher.dashboard import display_name
from app.schemas.dashboard import TeacherActivity, TeacherProfileStats

router = APIRouter(prefix="/teacher/profile", tags=["Teacher: profile"])

ACTIVITY_SHOWN = 6


@router.get("", response_model=TeacherProfileStats)
async def profile_stats(session: db_dep, teacher: teacher_dep):
    students = await session.scalar(select(func.count()).where(User.role == UserRole.STUDENT, User.is_active))
    tests_created = await session.scalar(select(func.count()).where(IeltsTest.created_by_id == teacher.id))
    # Writing оценивается по заданиям — считаем секции, а не задания
    writing_done = await session.scalar(
        select(func.count(distinct(WritingResponse.section_attempt_id)))
        .join(WritingAssessment, WritingAssessment.response_id == WritingResponse.id)
        .where(WritingAssessment.grader_id == teacher.id)
    )
    speaking_done = await session.scalar(
        select(func.count(distinct(SpeakingAssessment.section_attempt_id))).where(
            SpeakingAssessment.grader_id == teacher.id
        )
    )
    waiting = await session.scalar(
        select(func.count())
        .select_from(SectionAttempt)
        .join(SectionAttempt.section)
        .join(SectionAttempt.attempt)
        .where(
            Section.type.in_(REVIEWED),
            SectionAttempt.submitted_at.is_not(None),
            SectionAttempt.band_score.is_(None),
            TestAttempt.status != AttemptStatus.ABANDONED,
        )
    )

    created = await session.execute(
        select(IeltsTest.id, IeltsTest.title, IeltsTest.created_at)
        .where(IeltsTest.created_by_id == teacher.id)
        .order_by(IeltsTest.created_at.desc())
        .limit(ACTIVITY_SHOWN)
    )
    activity = [TeacherActivity(kind="test_created", at=r.created_at, title=r.title, test_id=r.id) for r in created]

    # последняя оценка каждой работы (Writing — по самой поздней оценке задания)
    writing = (
        select(
            WritingResponse.section_attempt_id.label("sa_id"),
            func.max(WritingAssessment.created_at).label("at"),
        )
        .join(WritingAssessment, WritingAssessment.response_id == WritingResponse.id)
        .where(WritingAssessment.grader_id == teacher.id)
        .group_by(WritingResponse.section_attempt_id)
    )
    speaking = (
        select(
            SpeakingAssessment.section_attempt_id.label("sa_id"),
            func.max(SpeakingAssessment.created_at).label("at"),
        )
        .where(SpeakingAssessment.grader_id == teacher.id)
        .group_by(SpeakingAssessment.section_attempt_id)
    )
    graded = writing.union_all(speaking).subquery()
    rows = await session.execute(
        select(
            graded.c.sa_id,
            graded.c.at,
            Section.type,
            SectionAttempt.band_score,
            User.email,
            UserProfile.first_name,
            UserProfile.last_name,
        )
        .join(SectionAttempt, SectionAttempt.id == graded.c.sa_id)
        .join(SectionAttempt.section)
        .join(SectionAttempt.attempt)
        .join(User, User.id == TestAttempt.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .order_by(graded.c.at.desc())
        .limit(ACTIVITY_SHOWN)
    )
    activity += [
        TeacherActivity(
            kind="work_assessed",
            at=r.at,
            student=display_name(r.first_name, r.last_name, r.email),
            section=r.type,
            band=r.band_score,
            section_attempt_id=r.sa_id,
        )
        for r in rows
    ]
    activity.sort(key=lambda a: a.at, reverse=True)

    return TeacherProfileStats(
        students=students or 0,
        tests_created=tests_created or 0,
        works_assessed=(writing_done or 0) + (speaking_done or 0),
        waiting_review=waiting or 0,
        activity=activity[:ACTIVITY_SHOWN],
    )
