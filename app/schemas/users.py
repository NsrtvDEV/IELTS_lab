from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models import QuestionType, SectionType, UserRole
from app.schemas.auth import Name


class ProfileResponse(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    native_language: str | None = None
    phone: str | None = None
    location: str | None = None
    bio: str | None = None
    avatar_url: str | None = None

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
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=30, pattern=r"^[0-9+()\- ]*$")] | None = (
        None
    )
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    bio: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


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
