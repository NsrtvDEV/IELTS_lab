from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

# имя / фамилия: пробелы по краям обрезаются, пустая строка не проходит
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: Name
    last_name: Name


class RegisterResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
