"""Администратор: обзор платформы и управление пользователями (роль, блокировка)."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, func, or_, select

from app.database import db_dep
from app.dependencies import admin_dep
from app.models import (
    AttemptStatus,
    IeltsTest,
    RefreshToken,
    Section,
    SectionAttempt,
    SiteContent,
    TestAttempt,
    User,
    UserProfile,
    UserRole,
)
from app.routers.site import LANDING_KEY, stored_landing
from app.routers.teacher.dashboard import display_name, percent_change
from app.schemas.admin import (
    AdminActivity,
    AdminDashboard,
    AdminUser,
    GrowthPoint,
    RoleCount,
    SkillStat,
    TopTest,
    UserUpdate,
)
from app.schemas.dashboard import Stat
from app.schemas.site import LandingContent

router = APIRouter(prefix="/admin", tags=["Admin"])

ACTIVITY_SHOWN = 6
TOP_TESTS_SHOWN = 5
RECENT_USERS_SHOWN = 5
GROWTH_DAYS = (7, 30, 90, 180)


def admin_user(user: User, profile: UserProfile | None) -> AdminUser:
    return AdminUser(
        id=user.id,
        name=display_name(profile.first_name if profile else None, profile.last_name if profile else None, user.email),
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        avatar_url=profile.avatar_url if profile else None,
        joined_at=user.created_at,
    )


def band(value) -> Decimal | None:
    return Decimal(value).quantize(Decimal("0.1")) if value is not None else None


@router.get("/dashboard", response_model=AdminDashboard)
async def dashboard(session: db_dep, admin: admin_dep):
    now = datetime.now(UTC)
    week_ago, month_ago, two_months_ago = now - timedelta(days=7), now - timedelta(days=30), now - timedelta(days=60)

    async def count(*where) -> int:
        return await session.scalar(select(func.count()).where(*where)) or 0

    users_now = await count(User.id.is_not(None))
    users_week_ago = await count(User.created_at < week_ago)
    teachers_now = await count(User.role == UserRole.TEACHER)
    teachers_week_ago = await count(User.role == UserRole.TEACHER, User.created_at < week_ago)
    tests_now = await count(IeltsTest.id.is_not(None))
    tests_week_ago = await count(IeltsTest.created_at < week_ago)

    graded = (
        SectionAttempt.band_score.is_not(None),
        SectionAttempt.submitted_at.is_not(None),
        TestAttempt.status != AttemptStatus.ABANDONED,
    )

    async def average_between(start: datetime | None, end: datetime | None):
        stmt = select(func.avg(SectionAttempt.band_score)).join(SectionAttempt.attempt).where(*graded)
        if start:
            stmt = stmt.where(SectionAttempt.submitted_at >= start)
        if end:
            stmt = stmt.where(SectionAttempt.submitted_at < end)
        return band(await session.scalar(stmt))

    avg_all = await average_between(None, None)
    avg_month = await average_between(month_ago, now)
    avg_before = await average_between(two_months_ago, month_ago)

    roles = dict((await session.execute(select(User.role, func.count()).group_by(User.role))).all())

    # ── последние события ──
    activity: list[AdminActivity] = []
    joined = await session.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .order_by(User.created_at.desc())
        .limit(ACTIVITY_SHOWN)
    )
    activity += [
        AdminActivity(
            kind="user_joined", at=u.created_at, user_name=admin_user(u, p).name, avatar_url=p.avatar_url if p else None
        )
        for u, p in joined
    ]
    completed = await session.execute(
        select(
            SectionAttempt.submitted_at,
            SectionAttempt.band_score,
            Section.type,
            IeltsTest.title,
            User.email,
            UserProfile.first_name,
            UserProfile.last_name,
            UserProfile.avatar_url,
        )
        .join(SectionAttempt.attempt)
        .join(SectionAttempt.section)
        .join(TestAttempt.test)
        .join(User, User.id == TestAttempt.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(SectionAttempt.submitted_at.is_not(None), TestAttempt.status != AttemptStatus.ABANDONED)
        .order_by(SectionAttempt.submitted_at.desc())
        .limit(ACTIVITY_SHOWN)
    )
    activity += [
        AdminActivity(
            kind="section_completed",
            at=r.submitted_at,
            user_name=display_name(r.first_name, r.last_name, r.email),
            avatar_url=r.avatar_url,
            section=r.type,
            band=r.band_score,
            test_title=r.title,
        )
        for r in completed
    ]
    created = await session.execute(
        select(
            IeltsTest.title,
            IeltsTest.created_at,
            User.email,
            UserProfile.first_name,
            UserProfile.last_name,
            UserProfile.avatar_url,
        )
        .outerjoin(User, User.id == IeltsTest.created_by_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .order_by(IeltsTest.created_at.desc())
        .limit(ACTIVITY_SHOWN)
    )
    activity += [
        AdminActivity(
            kind="test_created",
            at=r.created_at,
            user_name=display_name(r.first_name, r.last_name, r.email) if r.email else None,
            avatar_url=r.avatar_url,
            test_title=r.title,
        )
        for r in created
    ]
    activity.sort(key=lambda a: a.at, reverse=True)

    # ── тесты с лучшим средним баллом и популярность навыков ──
    top = await session.execute(
        select(IeltsTest.id, IeltsTest.title, func.avg(SectionAttempt.band_score), func.count(SectionAttempt.id))
        .select_from(SectionAttempt)
        .join(SectionAttempt.attempt)
        .join(TestAttempt.test)
        .where(*graded)
        .group_by(IeltsTest.id, IeltsTest.title)
        .order_by(func.avg(SectionAttempt.band_score).desc(), func.count(SectionAttempt.id).desc())
        .limit(TOP_TESTS_SHOWN)
    )
    skills = await session.execute(
        select(Section.type, func.count(SectionAttempt.id))
        .select_from(SectionAttempt)
        .join(SectionAttempt.section)
        .join(SectionAttempt.attempt)
        .where(SectionAttempt.submitted_at.is_not(None), TestAttempt.status != AttemptStatus.ABANDONED)
        .group_by(Section.type)
        .order_by(func.count(SectionAttempt.id).desc())
    )

    recent = await session.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .order_by(User.created_at.desc())
        .limit(RECENT_USERS_SHOWN)
    )

    return AdminDashboard(
        total_users=Stat(value=users_now, change=percent_change(users_now, users_week_ago)),
        total_teachers=Stat(value=teachers_now, change=percent_change(teachers_now, teachers_week_ago)),
        total_tests=Stat(value=tests_now, change=percent_change(tests_now, tests_week_ago)),
        average_band=Stat(
            value=avg_all,
            change=float(avg_month - avg_before) if avg_month is not None and avg_before is not None else None,
        ),
        roles=[RoleCount(role=r, count=roles.get(r, 0)) for r in UserRole],
        blocked_users=await count(User.is_active.is_(False)),
        activity=activity[:ACTIVITY_SHOWN],
        top_tests=[TopTest(id=i, title=t, average_band=band(a), attempts=n) for i, t, a, n in top],
        skills=[SkillStat(section=s, attempts=n) for s, n in skills],
        recent_users=[admin_user(u, p) for u, p in recent],
    )


@router.get("/growth", response_model=list[GrowthPoint])
async def growth(session: db_dep, admin: admin_dep, days: int = Query(30)):
    """Всего пользователей на конец каждого дня за период (7, 30, 90 или 180 дней)."""
    if days not in GROWTH_DAYS:
        raise HTTPException(status_code=422, detail=f"days must be one of {GROWTH_DAYS}")
    today = datetime.now(UTC).date()
    start = today - timedelta(days=days - 1)
    before = (
        await session.scalar(
            select(func.count()).where(User.created_at < datetime.combine(start, datetime.min.time(), UTC))
        )
        or 0
    )
    day = func.date(func.timezone("UTC", User.created_at))
    per_day = dict((await session.execute(select(day, func.count()).where(day >= start).group_by(day))).all())
    points, total = [], before
    for i in range(days):
        d = start + timedelta(days=i)
        total += per_day.get(d, 0)
        points.append(GrowthPoint(date=d, users=total))
    return points


@router.get("/users", response_model=list[AdminUser])
async def list_users(
    session: db_dep, admin: admin_dep, q: str | None = None, role: UserRole | None = None, blocked: bool | None = None
):
    """Все пользователи, новые сверху; q — поиск по имени, фамилии или email."""
    stmt = select(User, UserProfile).outerjoin(UserProfile, UserProfile.user_id == User.id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(User.email.ilike(like), UserProfile.first_name.ilike(like), UserProfile.last_name.ilike(like))
        )
    if role:
        stmt = stmt.where(User.role == role)
    if blocked is not None:
        stmt = stmt.where(User.is_active.is_(not blocked))
    rows = await session.execute(stmt.order_by(User.created_at.desc()))
    return [admin_user(u, p) for u, p in rows]


@router.patch("/users/{user_id}", response_model=AdminUser)
async def update_user(user_id: int, session: db_dep, admin: admin_dep, data: UserUpdate):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You can't change your own role or block yourself")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
        if not data.is_active:
            # заблокированного выкидываем со всех устройств сразу
            await session.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await session.commit()
    profile = await session.get(UserProfile, user.id)
    return admin_user(user, profile)


# ───────────────────────── Лендинг ─────────────────────────


@router.get("/landing", response_model=LandingContent, response_model_exclude_none=True)
async def get_landing(session: db_dep, admin: admin_dep):
    return await stored_landing(session)


@router.put("/landing", response_model=LandingContent, response_model_exclude_none=True)
async def save_landing(session: db_dep, admin: admin_dep, data: LandingContent):
    """Пустые поля не сохраняются — на сайте для них стандартный текст."""
    value = data.model_dump(exclude_none=True)
    row = await session.get(SiteContent, LANDING_KEY)
    if row:
        row.value = value
        row.updated_by_id = admin.id
    else:
        session.add(SiteContent(key=LANDING_KEY, value=value, updated_by_id=admin.id))
    await session.commit()
    return data


@router.delete("/landing", status_code=204)
async def reset_landing(session: db_dep, admin: admin_dep):
    """Вернуть стандартные тексты и настройки."""
    row = await session.get(SiteContent, LANDING_KEY)
    if row:
        await session.delete(row)
        await session.commit()
