"""Уведомления (колокольчик): создаются в момент события, в той же транзакции.

Ученику: работа оценена, секция сдана по истечении времени, опубликован новый тест.
Учителю: новая работа на проверку, работы ждут проверки дольше 2 дней.
Связи «учитель — ученики» нет, поэтому о новых работах узнают все учителя;
когда работу оценили, эти уведомления у всех убираются.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AttemptStatus,
    IeltsTest,
    Notification,
    Section,
    SectionAttempt,
    SectionType,
    TestAttempt,
    User,
    UserProfile,
    UserRole,
)

REVIEWED = (SectionType.WRITING, SectionType.SPEAKING)
WAITING_TOO_LONG = timedelta(days=2)
REMIND_EVERY = timedelta(days=1)
TEACHERS = (UserRole.TEACHER, UserRole.ADMIN)


def review_key(sa: SectionAttempt) -> str:
    return f"review:{sa.id}"


def result_link(sa: SectionAttempt) -> str:
    return f"/{sa.section.type}/{sa.id}/result"


def add(
    session: AsyncSession,
    user_ids,
    kind: str,
    text: str,
    link: str | None,
    ref_key: str | None = None,
    params: dict | None = None,
) -> None:
    for user_id in user_ids:
        session.add(Notification(user_id=user_id, kind=kind, text=text, params=params, link=link, ref_key=ref_key))


async def teacher_ids(session: AsyncSession) -> list[int]:
    return list(await session.scalars(select(User.id).where(User.role.in_(TEACHERS), User.is_active)))


async def student_name(session: AsyncSession, user_id: int) -> str:
    row = (
        await session.execute(
            select(User.email, UserProfile.first_name, UserProfile.last_name)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .where(User.id == user_id)
        )
    ).one()
    return " ".join(p for p in (row.first_name, row.last_name) if p) or row.email


# ───────────────────────── События ─────────────────────────


async def section_submitted(session: AsyncSession, sa: SectionAttempt, *, timed_out: bool) -> None:
    """Секция сдана: Writing/Speaking — учителям на проверку; по времени — сообщить ученику."""
    section = sa.section.type.capitalize()
    if timed_out:
        add(
            session,
            [sa.attempt.user_id],
            "auto_submitted",
            f"Time ran out — your {section} was submitted automatically",
            result_link(sa),
            params={"section": sa.section.type.value},
        )
    if sa.section.type in REVIEWED:
        name = await student_name(session, sa.attempt.user_id)
        add(
            session,
            await teacher_ids(session),
            "review_submitted",
            f"{name} submitted {section} — waiting for review",
            f"/teacher/review/{sa.section.type}/{sa.id}",
            review_key(sa),
            params={"section": sa.section.type.value, "name": name},
        )


async def work_assessed(session: AsyncSession, sa: SectionAttempt, *, updated: bool) -> None:
    """Учитель оценил Writing/Speaking: ученику — оценка, у учителей уведомление о работе убирается."""
    section = sa.section.type.capitalize()
    text = (
        f"Your {section} assessment was updated — band {sa.band_score}"
        if updated
        else f"Your {section} has been assessed — band {sa.band_score}"
    )
    add(
        session,
        [sa.attempt.user_id],
        "assessed",
        text,
        result_link(sa),
        params={"section": sa.section.type.value, "band": str(sa.band_score), "updated": updated},
    )
    await session.execute(delete(Notification).where(Notification.ref_key == review_key(sa)))


async def attempt_abandoned(session: AsyncSession, attempt: TestAttempt) -> None:
    """Прерванную попытку не проверяют — уведомления о её работах больше не нужны."""
    keys = [review_key(sa) for sa in attempt.section_attempts]
    if keys:
        await session.execute(delete(Notification).where(Notification.ref_key.in_(keys)))


async def test_published(session: AsyncSession, test: IeltsTest) -> None:
    """Новый тест — всем ученикам; при повторной публикации тем, кто уже знает, не дублируем."""
    key = f"test:{test.id}"
    students = await session.scalars(
        select(User.id).where(
            User.role == UserRole.STUDENT,
            User.is_active,
            ~exists().where(Notification.user_id == User.id, Notification.ref_key == key),
        )
    )
    add(
        session,
        students,
        "test_published",
        f"New test available: {test.title}",
        "/tests",
        key,
        params={"title": test.title},
    )


async def remind_waiting(session: AsyncSession, teacher: User) -> None:
    """Напоминание о работах, которые ждут дольше 2 дней, — не чаще раза в сутки.

    Отдельного планировщика нет: проверяем, когда учитель открывает уведомления.
    """
    now = datetime.now(UTC)
    recent = await session.scalar(
        select(
            exists().where(
                Notification.user_id == teacher.id,
                Notification.kind == "review_waiting",
                Notification.created_at > now - REMIND_EVERY,
            )
        )
    )
    if recent:
        return
    waiting = await session.scalar(
        select(func.count())
        .select_from(SectionAttempt)
        .join(SectionAttempt.section)
        .join(SectionAttempt.attempt)
        .where(
            Section.type.in_(REVIEWED),
            SectionAttempt.submitted_at < now - WAITING_TOO_LONG,
            SectionAttempt.band_score.is_(None),
            TestAttempt.status != AttemptStatus.ABANDONED,
        )
    )
    if waiting:
        works = "work has" if waiting == 1 else "works have"
        add(
            session,
            [teacher.id],
            "review_waiting",
            f"{waiting} {works} been waiting for review for more than 2 days",
            "/teacher/review",
            params={"count": waiting},
        )
        await session.commit()
