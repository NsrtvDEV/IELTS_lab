from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import QuestionType, SectionType, UserRole
from app.schemas.auth import Name


class ProfileResponse(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    native_language: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    profile: ProfileResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    first_name: Name | None = None
    last_name: Name | None = None
    native_language: str | None = Field(default=None, max_length=50)


class ProgressPoint(BaseModel):
    attempt_id: int
    section_attempt_id: int | None = None  # для ссылки на разбор секции
    test_title: str
    band: Decimal
    date: datetime


class QuestionTypeStats(BaseModel):
    type: QuestionType
    total: int
    wrong: int


class ProgressResponse(BaseModel):
    sections: dict[SectionType, list[ProgressPoint]]
    overall: list[ProgressPoint]  # только полные экзамены
    question_types: list[QuestionTypeStats]  # от самых проблемных
