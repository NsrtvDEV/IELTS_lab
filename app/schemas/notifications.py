from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    id: int
    kind: str  # assessed, auto_submitted, test_published, review_submitted, review_waiting
    text: str
    link: str | None  # путь на фронтенде
    read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationList(BaseModel):
    unread: int
    items: list[NotificationOut]  # новые сверху
