"""«Забыли пароль?»: письмо с одноразовой ссылкой и установка нового пароля."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete, select, update

from app.config import settings
from app.database import db_dep
from app.limiter import limiter
from app.mail import password_reset_email, send_email
from app.models import PasswordResetToken, RefreshToken, User, UserProfile
from app.schemas.auth import PasswordResetConfirm, PasswordResetRequest
from app.utils import generate_refresh_token, hash_password, hash_token

router = APIRouter(prefix="/auth/password-reset", tags=["Auth"])

RESEND_AFTER = timedelta(minutes=1)  # одно письмо в минуту на адрес
INVALID_LINK = "This link is invalid or has expired. Request a new one."


@router.post("/request", status_code=202)
@limiter.limit("5/minute")
async def request_reset(request: Request, session: db_dep, data: PasswordResetRequest, background: BackgroundTasks):
    """Ответ всегда одинаковый: по нему нельзя узнать, есть ли такой аккаунт."""
    row = (
        await session.execute(
            select(User, UserProfile.first_name)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .where(User.email == data.email.lower())
        )
    ).first()
    if row and row.User.is_active:
        user = row.User
        now = datetime.now(UTC)
        recent = await session.scalar(
            select(PasswordResetToken.id).where(
                PasswordResetToken.user_id == user.id, PasswordResetToken.created_at > now - RESEND_AFTER
            )
        )
        if not recent:
            token = generate_refresh_token()
            session.add(
                PasswordResetToken(
                    user_id=user.id,
                    token_hash=hash_token(token),
                    expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
                )
            )
            await session.commit()
            link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
            subject, text, html = password_reset_email(link, row.first_name, data.lang)
            background.add_task(send_email, user.email, subject, text, html)
    return {"detail": "If an account with this email exists, we've sent a link to reset the password."}


async def valid_token(session, token: str) -> PasswordResetToken:
    stored = await session.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(token)))
    if not stored or stored.used_at is not None or stored.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail=INVALID_LINK)
    return stored


@router.get("/check")
@limiter.limit("20/minute")
async def check_token(request: Request, session: db_dep, token: str):
    """Страница сброса сразу говорит, если ссылка уже не работает."""
    await valid_token(session, token)
    return {"valid": True}


@router.post("/confirm")
@limiter.limit("10/minute")
async def confirm_reset(request: Request, session: db_dep, data: PasswordResetConfirm):
    stored = await valid_token(session, data.token)
    user = await session.get(User, stored.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail=INVALID_LINK)
    user.password_hash = await run_in_threadpool(hash_password, data.new_password)
    now = datetime.now(UTC)
    stored.used_at = now
    # остальные ссылки на сброс больше не нужны; со всех устройств выходим
    await session.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    await session.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await session.commit()
    return {"detail": "Password changed. You can log in with the new password."}
