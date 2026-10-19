from fastapi import APIRouter
from sqlalchemy import Integer, cast, func, not_, select

from app.database import db_dep
from app.dependencies import current_user_dep
from app.models import (
    AttemptStatus,
    IeltsTest,
    Question,
    QuestionGroup,
    Section,
    SectionAttempt,
    TestAttempt,
    UserAnswer,
    UserProfile,
)
from app.schemas.users import (
    ProfileUpdate,
    ProgressPoint,
    ProgressResponse,
    QuestionTypeStats,
    UserResponse,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def me(current_user: current_user_dep):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(session: db_dep, current_user: current_user_dep, data: ProfileUpdate):
    if current_user.profile is None:
        current_user.profile = UserProfile()

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user.profile, field, value)

    await session.commit()
    await session.refresh(current_user)
    return current_user


@router.get("/me/progress", response_model=ProgressResponse)
async def progress(session: db_dep, current_user: current_user_dep):
    not_abandoned = TestAttempt.status != AttemptStatus.ABANDONED

    section_rows = (await session.execute(
        select(
            Section.type,
            TestAttempt.id,
            SectionAttempt.id,
            IeltsTest.title,
            SectionAttempt.band_score,
            SectionAttempt.submitted_at,
        )
        .join(SectionAttempt.attempt)
        .join(SectionAttempt.section)
        .join(TestAttempt.test)
        .where(
            TestAttempt.user_id == current_user.id,
            not_abandoned,
            SectionAttempt.band_score.is_not(None),
        )
        .order_by(SectionAttempt.submitted_at)
    )).all()

    sections: dict = {}
    for section_type, attempt_id, sa_id, title, band, submitted_at in section_rows:
        sections.setdefault(section_type, []).append(
            ProgressPoint(
                attempt_id=attempt_id,
                section_attempt_id=sa_id,
                test_title=title,
                band=band,
                date=submitted_at,
            )
        )

    overall_rows = (await session.execute(
        select(TestAttempt.id, IeltsTest.title, TestAttempt.overall_band, TestAttempt.finished_at)
        .join(TestAttempt.test)
        .where(
            TestAttempt.user_id == current_user.id,
            TestAttempt.overall_band.is_not(None),
        )
        .order_by(TestAttempt.finished_at)
    )).all()
    overall = [
        ProgressPoint(attempt_id=a_id, test_title=title, band=band, date=finished_at)
        for a_id, title, band, finished_at in overall_rows
    ]

    wrong = func.sum(cast(not_(UserAnswer.is_correct), Integer))
    type_rows = (await session.execute(
        select(QuestionGroup.type, func.count(), wrong)
        .select_from(UserAnswer)
        .join(Question, Question.id == UserAnswer.question_id)
        .join(Question.group)
        .join(SectionAttempt, SectionAttempt.id == UserAnswer.section_attempt_id)
        .join(SectionAttempt.attempt)
        .where(
            TestAttempt.user_id == current_user.id,
            not_abandoned,
            UserAnswer.is_correct.is_not(None),
        )
        .group_by(QuestionGroup.type)
        .order_by(wrong.desc())
    )).all()

    return ProgressResponse(
        sections=sections,
        overall=overall,
        question_types=[
            QuestionTypeStats(type=t, total=total, wrong=w or 0) for t, total, w in type_rows
        ],
    )
