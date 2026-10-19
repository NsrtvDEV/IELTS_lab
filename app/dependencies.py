from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import db_dep
from app.models import User, UserRole
from app.utils import decode_jwt_token

jwt_security = HTTPBearer(auto_error=False)


async def get_current_user(
    session: db_dep,
    credentials: HTTPAuthorizationCredentials | None = Depends(jwt_security),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    decode = decode_jwt_token(credentials.credentials)
    if decode.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user = await session.get(User, int(decode["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or blocked")

    return user


current_user_dep = Annotated[User, Depends(get_current_user)]


async def get_teacher(current_user: current_user_dep) -> User:
    if current_user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only teachers can do this")
    return current_user


teacher_dep = Annotated[User, Depends(get_teacher)]


async def get_admin(current_user: current_user_dep) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only administrators can do this")
    return current_user


admin_dep = Annotated[User, Depends(get_admin)]
