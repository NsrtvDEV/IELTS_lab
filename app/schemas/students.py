"""Ученики глазами учителя: список, история попыток."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.models import AttemptStatus, SectionType


class StudentSummary(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool
    joined_at: datetime
    sections_completed: int  # сданных секций за всё время
    bands: dict[SectionType, Decimal]  # последний band по каждой секции
    overall_band: Decimal | None
    last_activity_at: datetime | None


class HistoryItem(BaseModel):
    section_attempt_id: int
    attempt_id: int
    test_title: str
    section_type: SectionType
    mode: Literal["section", "mock"]  # отдельная секция или часть полного экзамена
    status: AttemptStatus
    started_at: datetime
    submitted_at: datetime | None
    raw_score: int | None
    band_score: Decimal | None


class StudentDetail(StudentSummary):
    native_language: str | None
    history: list[HistoryItem]
