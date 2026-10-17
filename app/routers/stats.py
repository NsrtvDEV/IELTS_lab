from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select

from app.database import db_dep
from app.models import AttemptStatus, IeltsTest, SectionAttempt, TestAttempt, User, UserRole

router = APIRouter(prefix="/stats", tags=["Stats"])


class PublicStats(BaseModel):
    students: int  # активные ученики
    tests: int  # опубликованные mock-тесты
    sections_completed: int  # сданные секции (без прерванных попыток)


@router.get("", response_model=PublicStats)
async def public_stats(session: db_dep):
    """Цифры для главной страницы — без авторизации, только агрегаты."""
    students = await session.scalar(
        select(func.count()).where(User.role == UserRole.STUDENT, User.is_active)
    )
    tests = await session.scalar(select(func.count()).where(IeltsTest.is_published))
    sections_completed = await session.scalar(
        select(func.count(SectionAttempt.id))
        .join(SectionAttempt.attempt)
        .where(
            SectionAttempt.submitted_at.is_not(None),
            TestAttempt.status != AttemptStatus.ABANDONED,
        )
    )
    return PublicStats(students=students, tests=tests, sections_completed=sections_completed)
