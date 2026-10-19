from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select, update

from app.database import db_dep
from app.dependencies import current_user_dep
from app.models import Notification
from app.notifications import TEACHERS, remind_waiting
from app.schemas.notifications import NotificationList, NotificationOut

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def out(n: Notification) -> NotificationOut:
    return NotificationOut(id=n.id, kind=n.kind, text=n.text, link=n.link, read=n.read_at is not None, created_at=n.created_at)


@router.get("", response_model=NotificationList)
async def list_notifications(session: db_dep, current_user: current_user_dep, limit: int = Query(20, ge=1, le=100)):
    """Последние уведомления и число непрочитанных (колокольчик опрашивает раз в 30 секунд)."""
    if current_user.role in TEACHERS:
        await remind_waiting(session, current_user)
    mine = Notification.user_id == current_user.id
    unread = await session.scalar(select(func.count()).where(mine, Notification.read_at.is_(None)))
    items = await session.scalars(
        select(Notification).where(mine).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)
    )
    return NotificationList(unread=unread or 0, items=[out(n) for n in items])


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(notification_id: int, session: db_dep, current_user: current_user_dep):
    n = await session.get(Notification, notification_id)
    if not n or n.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read_at = n.read_at or datetime.now(UTC)
    await session.commit()
    return out(n)


@router.post("/read-all", status_code=204)
async def mark_all_read(session: db_dep, current_user: current_user_dep):
    await session.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    await session.commit()
