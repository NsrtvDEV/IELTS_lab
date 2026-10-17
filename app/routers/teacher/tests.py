from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select

from app.content import (
    DEFAULT_SECTIONS,
    get_test,
    has_attempts,
    test_problems,
    test_response,
)
from app.database import db_dep
from app.media import remove_unused
from app.dependencies import teacher_dep
from app.models import IeltsTest, Passage, QuestionGroup, Section
from app.schemas.teacher import TeacherTest, TestCreate, TestUpdate

router = APIRouter(prefix="/teacher/tests", tags=["Teacher: tests"])


@router.post("", response_model=TeacherTest, status_code=201)
async def create_test(session: db_dep, teacher: teacher_dep, data: TestCreate):
    """Новый mock-тест сразу с 4 секциями и стандартным временем IELTS."""
    test = IeltsTest(
        title=data.title,
        sections=[
            Section(type=section_type, duration_min=minutes, position=i)
            for i, (section_type, minutes) in enumerate(DEFAULT_SECTIONS)
        ],
    )
    session.add(test)
    await session.commit()
    await session.refresh(test)
    return await test_response(session, test)


@router.get("", response_model=list[TeacherTest])
async def list_tests(session: db_dep, teacher: teacher_dep):
    """Все тесты, включая неопубликованные."""
    tests = await session.scalars(select(IeltsTest).order_by(IeltsTest.id.desc()))
    return [await test_response(session, t) for t in tests]


@router.get("/{test_id}", response_model=TeacherTest)
async def get_test_detail(test_id: int, session: db_dep, teacher: teacher_dep):
    return await test_response(session, await get_test(session, test_id))


@router.patch("/{test_id}", response_model=TeacherTest)
async def update_test(test_id: int, session: db_dep, teacher: teacher_dep, data: TestUpdate):
    test = await get_test(session, test_id)
    test.title = data.title  # название можно менять и у опубликованного теста
    await session.commit()
    await session.refresh(test)
    return await test_response(session, test)


@router.delete("/{test_id}", status_code=204)
async def delete_test(test_id: int, session: db_dep, teacher: teacher_dep):
    test = await get_test(session, test_id)
    if await has_attempts(session, test.id):
        raise HTTPException(
            status_code=409, detail="Students already took this test — unpublish it instead"
        )
    section_ids = [s.id for s in test.sections]
    files = list(
        await session.scalars(select(Passage.audio_url).where(Passage.section_id.in_(section_ids)))
    ) + list(
        await session.scalars(
            select(QuestionGroup.image_url).where(QuestionGroup.section_id.in_(section_ids))
        )
    )
    # секции, тексты и вопросы удаляет сама БД (ON DELETE CASCADE)
    await session.execute(delete(IeltsTest).where(IeltsTest.id == test.id))
    await session.commit()
    await remove_unused(session, files)


@router.post("/{test_id}/publish", response_model=TeacherTest)
async def publish_test(test_id: int, session: db_dep, teacher: teacher_dep):
    """Опубликовать: тест должен быть полным — все секции, 40 вопросов с ответами и т.д."""
    test = await get_test(session, test_id)
    problems = await test_problems(session, test)
    if problems:
        raise HTTPException(status_code=409, detail="Test is not complete: " + "; ".join(problems))
    test.is_published = True
    await session.commit()
    await session.refresh(test)
    return await test_response(session, test)


@router.post("/{test_id}/unpublish", response_model=TeacherTest)
async def unpublish_test(test_id: int, session: db_dep, teacher: teacher_dep):
    """Снять с публикации: ученики больше не видят тест; начатые попытки не трогаются."""
    test = await get_test(session, test_id)
    test.is_published = False
    await session.commit()
    await session.refresh(test)
    return await test_response(session, test)

