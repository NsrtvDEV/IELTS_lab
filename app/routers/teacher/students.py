from fastapi import APIRouter, HTTPException
from sqlalchemy import or_, select

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
    UserRole,
)
from app.routers.teacher.dashboard import display_name, overall
from app.schemas.questions import QuestionSectionResult
from app.schemas.students import HistoryItem, StudentDetail, StudentSummary
from app.sections import question_section_result

router = APIRouter(prefix="/teacher/students", tags=["Teacher: students"])

QUESTION_SECTIONS = {SectionType.LISTENING, SectionType.READING}


async def history_rows(session, user_ids: list[int]):
    """Все начатые секции учеников, новые первыми."""
    return (
        await session.execute(
            select(
                SectionAttempt.id,
                SectionAttempt.started_at,
                SectionAttempt.submitted_at,
                SectionAttempt.raw_score,
                SectionAttempt.band_score,
                Section.type,
                TestAttempt.id.label("attempt_id"),
                TestAttempt.user_id,
                TestAttempt.status,
                TestAttempt.section_type.label("attempt_section"),
                IeltsTest.title,
            )
            .join(SectionAttempt.attempt)
            .join(SectionAttempt.section)
            .join(TestAttempt.test)
            .where(TestAttempt.user_id.in_(user_ids))
            .order_by(SectionAttempt.started_at.desc())
        )
    ).all()


def summarize(user: User, profile: UserProfile | None, rows) -> StudentSummary:
    graded = [
        r for r in rows if r.band_score is not None and r.status != AttemptStatus.ABANDONED
    ]
    latest: dict = {}
    for r in sorted(graded, key=lambda r: r.submitted_at):  # старые -> новые
        latest[r.type] = r.band_score
    submitted = [r for r in rows if r.submitted_at is not None]
    return StudentSummary(
        id=user.id,
        name=display_name(
            profile.first_name if profile else None,
            profile.last_name if profile else None,
            user.email,
        ),
        email=user.email,
        is_active=user.is_active,
        joined_at=user.created_at,
        sections_completed=len(submitted),
        bands=latest,
        overall_band=overall(latest),
        last_activity_at=max((r.submitted_at for r in submitted), default=None),
    )


@router.get("", response_model=list[StudentSummary])
async def list_students(session: db_dep, teacher: teacher_dep, q: str | None = None):
    """Все ученики; q — поиск по имени, фамилии или email."""
    stmt = (
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.role == UserRole.STUDENT)
        .order_by(User.created_at.desc())
    )
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(User.email.ilike(like), UserProfile.first_name.ilike(like), UserProfile.last_name.ilike(like))
        )
    students = (await session.execute(stmt)).all()

    rows = await history_rows(session, [u.id for u, _ in students])
    by_user: dict[int, list] = {}
    for r in rows:
        by_user.setdefault(r.user_id, []).append(r)

    summaries = [summarize(u, p, by_user.get(u.id, [])) for u, p in students]
    # сначала те, кто занимался недавно
    summaries.sort(key=lambda s: (s.last_activity_at is not None, s.last_activity_at or s.joined_at), reverse=True)
    return summaries


@router.get("/{student_id}", response_model=StudentDetail)
async def get_student(student_id: int, session: db_dep, teacher: teacher_dep):
    row = (
        await session.execute(
            select(User, UserProfile)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .where(User.id == student_id, User.role == UserRole.STUDENT)
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    user, profile = row

    rows = await history_rows(session, [user.id])
    summary = summarize(user, profile, rows)
    return StudentDetail(
        **summary.model_dump(),
        native_language=profile.native_language if profile else None,
        history=[
            HistoryItem(
                section_attempt_id=r.id,
                attempt_id=r.attempt_id,
                test_title=r.title,
                section_type=r.type,
                mode="section" if r.attempt_section else "mock",
                status=r.status,
                started_at=r.started_at,
                submitted_at=r.submitted_at,
                raw_score=r.raw_score,
                band_score=r.band_score,
            )
            for r in rows
        ],
    )


@router.get("/{student_id}/results/{section_attempt_id}", response_model=QuestionSectionResult)
async def student_result(
    student_id: int, section_attempt_id: int, session: db_dep, teacher: teacher_dep
):
    """Разбор сданной секции ученика (Reading / Listening): ответы и правильные ответы."""
    sa = await session.get(SectionAttempt, section_attempt_id)
    if not sa or sa.attempt.user_id != student_id or sa.section.type not in QUESTION_SECTIONS:
        raise HTTPException(status_code=404, detail="Result not found")
    return await question_section_result(session, sa)
