from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import db_dep
from app.limiter import limiter
from app.models import RefreshToken, User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.utils import (
    generate_access_token,
    generate_refresh_token,
    hash_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


async def issue_tokens(session: AsyncSession, user: User) -> TokenResponse:
    refresh_token = generate_refresh_token()
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await session.commit()
    return TokenResponse(
        access_token=generate_access_token(user.id), refresh_token=refresh_token
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, session: db_dep, data: LoginRequest):
    user = await session.scalar(select(User).where(User.email == data.email.lower()))

    # argon2 намеренно медленный — считаем в потоке, чтобы не блокировать event loop
    if not user or not await run_in_threadpool(
        verify_password, data.password, user.password_hash
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is blocked")

    return await issue_tokens(session, user)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh(request: Request, session: db_dep, data: RefreshRequest):
    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(data.refresh_token))
    )

    if not stored:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if stored.revoked:
        # отозванный токен использовали повторно — вероятно, его украли:
        # отзываем все сессии пользователя
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == stored.user_id)
            .values(revoked=True)
        )
        await session.commit()
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    if stored.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user = await session.get(User, stored.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or blocked")

    # ротация: старый токен больше не действует
    stored.revoked = True
    return await issue_tokens(session, user)


@router.post("/logout", status_code=204)
async def logout(session: db_dep, data: RefreshRequest):
    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(data.refresh_token))
    )

    if stored:
        stored.revoked = True
        await session.commit()
