from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import db_dep
from app.dependencies import current_user_dep
from app.models import AttemptStatus, IeltsTest, Section, SectionAttempt, TestAttempt
from app.schemas.tests import TestResponse

router = APIRouter(prefix="/tests", tags=["Tests"])


async def completed_sections(session: AsyncSession, user_id: int) -> dict[int, list]:
    """test_id → секции, которые ученик сдал хотя бы раз."""
    rows = (await session.execute(
        select(TestAttempt.test_id, Section.type)
        .join(SectionAttempt.attempt)
        .join(SectionAttempt.section)
        .where(
            TestAttempt.user_id == user_id,
            TestAttempt.status != AttemptStatus.ABANDONED,
            SectionAttempt.submitted_at.is_not(None),
        )
        .distinct()
    )).all()
    result: dict[int, list] = {}
    for test_id, section_type in rows:
        result.setdefault(test_id, []).append(section_type)
    return result


@router.get("", response_model=list[TestResponse])
async def list_tests(session: db_dep, current_user: current_user_dep):
    tests = await session.scalars(
        select(IeltsTest).where(IeltsTest.is_published).order_by(IeltsTest.id.desc())
    )
    done = await completed_sections(session, current_user.id)

    return [
        TestResponse(
            id=t.id,
            title=t.title,
            sections=t.sections,
            completed_sections=done.get(t.id, []),
        )
        for t in tests
    ]


@router.get("/{test_id}", response_model=TestResponse)
async def get_test(test_id: int, session: db_dep, current_user: current_user_dep):
    test = await session.get(IeltsTest, test_id)
    if not test or not test.is_published:
        raise HTTPException(status_code=404, detail="Test not found")

    return TestResponse(
        id=test.id,
        title=test.title,
        sections=test.sections,
        completed_sections=(await completed_sections(session, current_user.id)).get(
            test.id, []
        ),
    )
