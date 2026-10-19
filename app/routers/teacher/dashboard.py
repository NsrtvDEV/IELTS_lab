from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter
from sqlalchemy import func, select

from app.content import question_counts, test_problems
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
from app.schemas.dashboard import (
    Activity,
    DashboardStats,
    Performance,
    SectionPerformance,
    Stat,
    StudentProgress,
    TeacherDashboard,
    TestSummary,
)
from app.scoring import SECTION_ORDER, round_band

router = APIRouter(prefix="/teacher/dashboard", tags=["Teacher: dashboard"])

STUDENTS_SHOWN = 7
ACTIVITIES_SHOWN = 6
TESTS_SHOWN = 5


def percent_change(current: int, previous: int) -> float | None:
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


def overall(latest_by_section: dict[SectionType, Decimal]) -> Decimal | None:
    """Общий band ученика: среднее последних результатов по каждой секции."""
    if not latest_by_section:
        return None
    return round_band(sum(latest_by_section.values()) / len(latest_by_section))


def display_name(first: str | None, last: str | None, email: str) -> str:
    return " ".join(p for p in (first, last) if p) or email


@router.get("", response_model=TeacherDashboard)
async def dashboard(session: db_dep, teacher: teacher_dep):
    now = datetime.now(UTC)
    month_ago, two_months_ago = now - timedelta(days=30), now - timedelta(days=60)
    is_student = User.role == UserRole.STUDENT

    # ── ученики ──
    total_students = await session.scalar(select(func.count()).where(is_student)) or 0
    students_month_ago = await session.scalar(select(func.count()).where(is_student, User.created_at < month_ago)) or 0

    # ── тесты ──
    test_rows = list(await session.scalars(select(IeltsTest).order_by(IeltsTest.updated_at.desc())))
    published = sum(t.is_published for t in test_rows)
    published_month_ago = sum(t.is_published and t.created_at < month_ago for t in test_rows)

    async def finished_between(start: datetime, end: datetime) -> int:
        return (
            await session.scalar(
                select(func.count()).where(
                    TestAttempt.status == AttemptStatus.FINISHED,
                    TestAttempt.finished_at >= start,
                    TestAttempt.finished_at < end,
                )
            )
            or 0
        )

    tests_completed = (
        await session.scalar(select(func.count()).where(TestAttempt.status == AttemptStatus.FINISHED)) or 0
    )
    completed_change = percent_change(
        await finished_between(month_ago, now), await finished_between(two_months_ago, month_ago)
    )

    # ── результаты по секциям: все оценённые секции учеников ──
    graded = (
        await session.execute(
            select(
                SectionAttempt.band_score,
                SectionAttempt.submitted_at,
                Section.type,
                TestAttempt.section_type,
                TestAttempt.user_id,
                User.email,
                User.created_at,
                UserProfile.first_name,
                UserProfile.last_name,
                UserProfile.avatar_url,
            )
            .join(SectionAttempt.attempt)
            .join(SectionAttempt.section)
            .join(User, User.id == TestAttempt.user_id)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .where(
                is_student,
                TestAttempt.status != AttemptStatus.ABANDONED,
                SectionAttempt.band_score.is_not(None),
                SectionAttempt.submitted_at.is_not(None),
            )
            .order_by(SectionAttempt.submitted_at)
        )
    ).all()

    def average(rows) -> Decimal | None:
        bands = [r.band_score for r in rows]
        return (sum(bands) / len(bands)).quantize(Decimal("0.1")) if bands else None

    avg_now = average([r for r in graded if r.submitted_at >= month_ago])
    avg_before = average([r for r in graded if two_months_ago <= r.submitted_at < month_ago])
    avg_all = average(graded)
    band_change = float(avg_now - avg_before) if avg_now is not None and avg_before is not None else None

    by_section: dict[SectionType, list] = defaultdict(list)
    for r in graded:
        by_section[r.type].append(r)
    sections = [
        SectionPerformance(section_type=t, band=average(by_section[t]), attempts=len(by_section[t]))
        for t in SECTION_ORDER
    ]
    section_avgs = {s.section_type: s.band for s in sections if s.band is not None}

    # ── прогресс учеников ──
    by_student: dict[int, list] = defaultdict(list)
    for r in graded:
        by_student[r.user_id].append(r)

    students = []
    for rows in by_student.values():
        latest: dict[SectionType, Decimal] = {}
        before_last: dict[SectionType, Decimal] = {}
        for i, r in enumerate(rows):
            latest[r.type] = r.band_score
            if i < len(rows) - 1:
                before_last[r.type] = r.band_score
        last = rows[-1]
        now_band, prev_band = overall(latest), overall(before_last)
        section_name = last.type.value.capitalize()
        students.append(
            StudentProgress(
                id=last.user_id,
                name=display_name(last.first_name, last.last_name, last.email),
                email=last.email,
                avatar_url=last.avatar_url,
                overall_band=now_band,
                change=now_band - prev_band if prev_band is not None else None,
                last_activity=f"{section_name} test" if last.section_type else f"Mock test · {section_name}",
                last_section=last.type,
                last_in_mock=not last.section_type,
                last_activity_at=last.submitted_at,
            )
        )
    students.sort(key=lambda s: s.last_activity_at, reverse=True)

    # ── последние события ──
    activities = [
        Activity(
            kind="section_completed",
            student=display_name(r.first_name, r.last_name, r.email),
            text=f"got {r.band_score} in {r.type.value.capitalize()}",
            section=r.type,
            band=r.band_score,
            at=r.submitted_at,
        )
        for r in graded[-ACTIVITIES_SHOWN:]
    ]
    finished_mocks = (
        await session.execute(
            select(
                TestAttempt.overall_band,
                TestAttempt.finished_at,
                IeltsTest.title,
                User.email,
                UserProfile.first_name,
                UserProfile.last_name,
            )
            .join(TestAttempt.test)
            .join(User, User.id == TestAttempt.user_id)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .where(TestAttempt.overall_band.is_not(None))
            .order_by(TestAttempt.finished_at.desc())
            .limit(ACTIVITIES_SHOWN)
        )
    ).all()
    activities += [
        Activity(
            kind="mock_completed",
            student=display_name(m.first_name, m.last_name, m.email),
            text=f"completed {m.title} — overall {m.overall_band}",
            band=m.overall_band,
            title=m.title,
            at=m.finished_at,
        )
        for m in finished_mocks
    ]
    joined = (
        await session.execute(
            select(User.email, User.created_at, UserProfile.first_name, UserProfile.last_name)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .where(is_student)
            .order_by(User.created_at.desc())
            .limit(ACTIVITIES_SHOWN)
        )
    ).all()
    activities += [
        Activity(
            kind="joined",
            student=display_name(j.first_name, j.last_name, j.email),
            text="joined BandUp",
            at=j.created_at,
        )
        for j in joined
    ]
    activities.sort(key=lambda a: a.at, reverse=True)

    # ── тесты учителя ──
    shown = test_rows[:TESTS_SHOWN]
    counts = await question_counts(session, [s.id for t in shown for s in t.sections])
    tests = [
        TestSummary(
            id=t.id,
            title=t.title,
            is_published=t.is_published,
            problems=0 if t.is_published else len(await test_problems(session, t)),
            questions=sum(counts.get(s.id, 0) for s in t.sections),
        )
        for t in shown
    ]

    return TeacherDashboard(
        stats=DashboardStats(
            total_students=Stat(
                value=total_students,
                change=percent_change(total_students, students_month_ago),
            ),
            published_tests=Stat(value=published, change=percent_change(published, published_month_ago)),
            draft_tests=len(test_rows) - published,
            tests_completed=Stat(value=tests_completed, change=completed_change),
            average_band=Stat(value=avg_all, change=band_change),
        ),
        students=students[:STUDENTS_SHOWN],
        performance=Performance(
            overall_band=round_band(sum(section_avgs.values()) / len(section_avgs)) if section_avgs else None,
            sections=sections,
        ),
        activities=activities[:ACTIVITIES_SHOWN],
        tests=tests,
    )
