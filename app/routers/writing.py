from fastapi import APIRouter

from app.database import db_dep
from app.dependencies import current_user_dep
from app.models import SectionType
from app.schemas.attempts import SectionAttemptShort
from app.schemas.writing import WritingContent, WritingDraft, WritingResult, WritingSave
from app.sections import (
    get_open_section_attempt,
    get_own_attempt,
    get_own_section_attempt,
    start_section,
    submit,
)
from app.writing import save_draft, writing_content, writing_result

router = APIRouter(prefix="/writing", tags=["Writing"])

WRITING = SectionType.WRITING


@router.post("/attempts/{attempt_id}/start", response_model=WritingContent)
async def start_writing(attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Начать Writing (или продолжить начатый): Task 1 и Task 2, 60 минут."""
    attempt = await get_own_attempt(session, attempt_id, current_user)
    sa = await start_section(session, attempt, WRITING)
    return await writing_content(session, sa)


@router.get("/{section_attempt_id}", response_model=WritingContent)
async def get_writing(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Задания и сохранённые тексты — пока секция не сдана."""
    sa = await get_open_section_attempt(session, section_attempt_id, current_user, WRITING)
    return await writing_content(session, sa)


@router.put("/{section_attempt_id}/tasks/{task_id}", response_model=WritingDraft)
async def save_writing(
    section_attempt_id: int, task_id: int, session: db_dep, current_user: current_user_dep, data: WritingSave
):
    """Автосохранение текста задания; число слов считает сервер."""
    sa = await get_open_section_attempt(session, section_attempt_id, current_user, WRITING)
    return await save_draft(session, sa, task_id, data.text)


@router.post("/{section_attempt_id}/submit", response_model=SectionAttemptShort)
async def submit_writing(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Сдать Writing: работа уходит преподавателю на проверку."""
    sa = await get_own_section_attempt(session, section_attempt_id, current_user, WRITING)
    return await submit(session, sa)


@router.get("/{section_attempt_id}/result", response_model=WritingResult)
async def writing_result_endpoint(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Тексты ученика и — после проверки — оценки по критериям и отзыв."""
    sa = await get_own_section_attempt(session, section_attempt_id, current_user, WRITING)
    return await writing_result(session, sa)
