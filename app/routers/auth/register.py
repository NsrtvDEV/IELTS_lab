from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select

from app.database import db_dep
from app.limiter import limiter
from app.models import User, UserProfile
from app.schemas.auth import RegisterRequest, RegisterResponse
from app.utils import hash_password

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
@limiter.limit("10/minute")
async def register(request: Request, session: db_dep, data: RegisterRequest):
    email = data.email.lower()
    exists = await session.scalar(select(User.id).where(User.email == email))
    if exists:
        raise HTTPException(status_code=409, detail="Email already registered")

    password_hash = await run_in_threadpool(hash_password, data.password)
    user = User(email=email, password_hash=password_hash)
    user.profile = UserProfile(first_name=data.first_name, last_name=data.last_name)
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user
