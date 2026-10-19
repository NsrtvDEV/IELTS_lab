from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app import notifications
from app.database import db_dep
from app.dependencies import current_user_dep
from app.models import AttemptStatus, IeltsTest, TestAttempt
from app.schemas.attempts import AttemptCreate, AttemptResponse
from app.scoring import SECTION_ORDER
from app.sections import attempt_response, close_expired_sections, get_own_attempt

router = APIRouter(prefix="/attempts", tags=["Attempts"])


@router.post("", response_model=AttemptResponse, status_code=201)
async def create_attempt(session: db_dep, current_user: current_user_dep, data: AttemptCreate):
    """Начать попытку: весь mock-тест (section_type не указан) или одну секцию."""
    test = await session.get(IeltsTest, data.test_id)
    if not test or not test.is_published:
        raise HTTPException(status_code=404, detail="Test not found")

    test_sections = {s.type for s in test.sections}
    needed = [data.section_type] if data.section_type else SECTION_ORDER
    missing = [t.value for t in needed if t not in test_sections]
    if missing:
        raise HTTPException(status_code=400, detail=f"Test has no sections: {missing}")

    attempt = TestAttempt(
        user_id=current_user.id,
        test_id=test.id,
        section_type=data.section_type,
        status=AttemptStatus.IN_PROGRESS,
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    return attempt_response(attempt)


@router.get("", response_model=list[AttemptResponse])
async def list_attempts(session: db_dep, current_user: current_user_dep):
    attempts = (
        await session.scalars(
            select(TestAttempt).where(TestAttempt.user_id == current_user.id).order_by(TestAttempt.started_at.desc())
        )
    ).unique()

    result = []
    for attempt in attempts:
        await close_expired_sections(session, attempt)
        result.append(attempt_response(attempt))
    return result


@router.get("/{attempt_id}", response_model=AttemptResponse)
async def get_attempt(attempt_id: int, session: db_dep, current_user: current_user_dep):
    attempt = await get_own_attempt(session, attempt_id, current_user)
    return attempt_response(attempt)


@router.post("/{attempt_id}/abandon", response_model=AttemptResponse)
async def abandon_attempt(attempt_id: int, session: db_dep, current_user: current_user_dep):
    attempt = await get_own_attempt(session, attempt_id, current_user)
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Attempt is not in progress")

    attempt.status = AttemptStatus.ABANDONED
    await notifications.attempt_abandoned(session, attempt)
    await session.commit()
    return attempt_response(attempt)
