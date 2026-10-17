"""Дашборд учителя: сводка по ученикам, тестам и результатам."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.models import SectionType


class Stat(BaseModel):
    value: int | Decimal | None
    # изменение за последние 30 дней относительно предыдущих 30:
    # для счётчиков — в процентах, для band — в баллах; None — не с чем сравнить
    change: float | None = None


class DashboardStats(BaseModel):
    total_students: Stat
    published_tests: Stat
    draft_tests: int
    tests_completed: Stat
    average_band: Stat


class StudentProgress(BaseModel):
    id: int
    name: str
    email: str
    overall_band: Decimal
    change: Decimal | None  # относительно результата до последней сданной секции
    last_activity: str  # "Reading test", "Mock test · Listening"
    last_activity_at: datetime


class SectionPerformance(BaseModel):
    section_type: SectionType
    band: Decimal | None  # средний band всех учеников; None — ещё нет результатов
    attempts: int


class Performance(BaseModel):
    overall_band: Decimal | None
    sections: list[SectionPerformance]


class Activity(BaseModel):
    kind: Literal["joined", "section_completed", "mock_completed"]
    student: str
    text: str
    at: datetime


class TestSummary(BaseModel):
    __test__ = False

    id: int
    title: str
    is_published: bool
    problems: int  # сколько пунктов мешает публикации
    questions: int  # вопросов в Listening + Reading (из 80)


class TeacherDashboard(BaseModel):
    stats: DashboardStats
    students: list[StudentProgress]
    performance: Performance
    activities: list[Activity]
    tests: list[TestSummary]
