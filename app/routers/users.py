from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import Integer, cast, delete, func, not_, select

from app.database import db_dep
from app.dependencies import current_user_dep
from app.limiter import limiter
from app.media import file_type, media_path, store
from app.models import (
    AttemptStatus,
    IeltsTest,
    Question,
    QuestionGroup,
    RefreshToken,
    Section,
    SectionAttempt,
    TestAttempt,
    UserAnswer,
    UserProfile,
)
from app.routers.auth.auth import issue_tokens
from app.schemas.auth import TokenResponse
from app.schemas.users import (
    PasswordChange,
    ProfileUpdate,
    ProgressPoint,
    ProgressResponse,
    QuestionTypeStats,
    UserResponse,
)
from app.utils import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def me(current_user: current_user_dep):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(session: db_dep, current_user: current_user_dep, data: ProfileUpdate):
    if current_user.profile is None:
        current_user.profile = UserProfile()

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user.profile, field, value)

    await session.commit()
    await session.refresh(current_user)
    return current_user


# аватар загружает любой пользователь — без SVG (в нём может быть скрипт)
AVATAR_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
MAX_AVATAR_MB = 2


async def drop_avatar_file(url: str | None) -> None:
    path = media_path(url)
    if path and path.parent.name == "avatars":
        await run_in_threadpool(path.unlink, True)


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(session: db_dep, current_user: current_user_dep, file: UploadFile = File(...)):
    extension = AVATAR_TYPES.get(file_type(file))
    if not extension:
        raise HTTPException(status_code=415, detail="Upload a PNG, JPG or WEBP image")
    url = await store(file, "avatars", extension, MAX_AVATAR_MB)
    if current_user.profile is None:
        current_user.profile = UserProfile()
    old = current_user.profile.avatar_url
    current_user.profile.avatar_url = url
    await session.commit()
    await drop_avatar_file(old)
    await session.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserResponse)
async def delete_avatar(session: db_dep, current_user: current_user_dep):
    if current_user.profile and current_user.profile.avatar_url:
        old = current_user.profile.avatar_url
        current_user.profile.avatar_url = None
        await session.commit()
        await drop_avatar_file(old)
        await session.refresh(current_user)
    return current_user


@router.post("/me/password", response_model=TokenResponse)
@limiter.limit("5/minute")
async def change_password(request: Request, session: db_dep, current_user: current_user_dep, data: PasswordChange):
    if not await run_in_threadpool(verify_password, data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = await run_in_threadpool(hash_password, data.new_password)
    # выходим на остальных устройствах (токены удаляем, а не отзываем, чтобы их
    # повторное использование не сработало как кража); текущему — новая пара токенов
    await session.execute(delete(RefreshToken).where(RefreshToken.user_id == current_user.id))
    return await issue_tokens(session, current_user)


@router.get("/me/progress", response_model=ProgressResponse)
async def progress(session: db_dep, current_user: current_user_dep):
    not_abandoned = TestAttempt.status != AttemptStatus.ABANDONED

    section_rows = (await session.execute(
        select(
            Section.type,
            TestAttempt.id,
            SectionAttempt.id,
            IeltsTest.title,
            SectionAttempt.band_score,
            SectionAttempt.submitted_at,
        )
        .join(SectionAttempt.attempt)
        .join(SectionAttempt.section)
        .join(TestAttempt.test)
        .where(
            TestAttempt.user_id == current_user.id,
            not_abandoned,
            SectionAttempt.band_score.is_not(None),
        )
        .order_by(SectionAttempt.submitted_at)
    )).all()

    sections: dict = {}
    for section_type, attempt_id, sa_id, title, band, submitted_at in section_rows:
        sections.setdefault(section_type, []).append(
            ProgressPoint(
                attempt_id=attempt_id,
                section_attempt_id=sa_id,
                test_title=title,
                band=band,
                date=submitted_at,
            )
        )

    overall_rows = (await session.execute(
        select(TestAttempt.id, IeltsTest.title, TestAttempt.overall_band, TestAttempt.finished_at)
        .join(TestAttempt.test)
        .where(
            TestAttempt.user_id == current_user.id,
            TestAttempt.overall_band.is_not(None),
        )
        .order_by(TestAttempt.finished_at)
    )).all()
    overall = [
        ProgressPoint(attempt_id=a_id, test_title=title, band=band, date=finished_at)
        for a_id, title, band, finished_at in overall_rows
    ]

    wrong = func.sum(cast(not_(UserAnswer.is_correct), Integer))
    type_rows = (await session.execute(
        select(QuestionGroup.type, func.count(), wrong)
        .select_from(UserAnswer)
        .join(Question, Question.id == UserAnswer.question_id)
        .join(Question.group)
        .join(SectionAttempt, SectionAttempt.id == UserAnswer.section_attempt_id)
        .join(SectionAttempt.attempt)
        .where(
            TestAttempt.user_id == current_user.id,
            not_abandoned,
            UserAnswer.is_correct.is_not(None),
        )
        .group_by(QuestionGroup.type)
        .order_by(wrong.desc())
    )).all()

    return ProgressResponse(
        sections=sections,
        overall=overall,
        question_types=[
            QuestionTypeStats(type=t, total=total, wrong=w or 0) for t, total, w in type_rows
        ],
    )
