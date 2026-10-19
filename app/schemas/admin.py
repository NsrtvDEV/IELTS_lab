from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.models import SectionType, UserRole
from app.schemas.dashboard import Stat


class RoleCount(BaseModel):
    role: UserRole
    count: int


class AdminActivity(BaseModel):
    kind: Literal["user_joined", "section_completed", "test_created"]
    at: datetime
    user_name: str | None = None  # кто: ученик / автор теста
    avatar_url: str | None = None
    section: SectionType | None = None
    band: Decimal | None = None
    test_title: str | None = None


class TopTest(BaseModel):
    __test__ = False

    id: int
    title: str
    average_band: Decimal
    attempts: int  # сданных секций


class SkillStat(BaseModel):
    section: SectionType
    attempts: int


class AdminUser(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    is_active: bool
    avatar_url: str | None
    joined_at: datetime


class AdminDashboard(BaseModel):
    """Главная администратора: изменения — за неделю (пользователи, тесты) и за месяц (средний балл)."""

    total_users: Stat
    total_teachers: Stat
    total_tests: Stat
    average_band: Stat
    roles: list[RoleCount]
    blocked_users: int
    activity: list[AdminActivity]  # новые сверху
    top_tests: list[TopTest]
    skills: list[SkillStat]  # от самой популярной
    recent_users: list[AdminUser]


class GrowthPoint(BaseModel):
    date: date
    users: int  # всего пользователей на конец дня


class UserUpdate(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None
