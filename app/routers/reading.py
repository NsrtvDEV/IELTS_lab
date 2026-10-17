from fastapi import APIRouter

from app.database import db_dep
from app.dependencies import current_user_dep
from app.models import SectionType
from app.schemas.attempts import SectionAttemptShort
from app.schemas.questions import AnswersSave, QuestionSectionContent, QuestionSectionResult
from app.sections import (
    get_open_section_attempt,
    get_own_attempt,
    get_own_section_attempt,
    question_section_content,
    question_section_result,
    save_question_answers,
    start_section,
    submit,
)

router = APIRouter(prefix="/reading", tags=["Reading"])

READING = SectionType.READING


@router.post("/attempts/{attempt_id}/start", response_model=QuestionSectionContent)
async def start_reading(attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Начать Reading (или продолжить начатый): 3 текста и 40 вопросов, 60 минут."""
    attempt = await get_own_attempt(session, attempt_id, current_user)
    sa = await start_section(session, attempt, READING)
    return await question_section_content(session, sa)


@router.get("/{section_attempt_id}", response_model=QuestionSectionContent)
async def get_reading(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Тексты, вопросы и сохранённые ответы — пока секция не сдана."""
    sa = await get_open_section_attempt(session, section_attempt_id, current_user, READING)
    return await question_section_content(session, sa)


@router.put("/{section_attempt_id}/answers", status_code=204)
async def save_reading_answers(
    section_attempt_id: int, session: db_dep, current_user: current_user_dep, data: AnswersSave
):
    """Автосохранение ответов: можно присылать все ответы или только изменённые."""
    sa = await get_open_section_attempt(session, section_attempt_id, current_user, READING)
    await save_question_answers(session, sa, data.answers)


@router.post("/{section_attempt_id}/submit", response_model=SectionAttemptShort)
async def submit_reading(
    section_attempt_id: int, session: db_dep, current_user: current_user_dep
):
    """Сдать Reading: ответы проверяются сразу, raw score переводится в band."""
    sa = await get_own_section_attempt(session, section_attempt_id, current_user, READING)
    return await submit(session, sa)


@router.get("/{section_attempt_id}/result", response_model=QuestionSectionResult)
async def reading_result(
    section_attempt_id: int, session: db_dep, current_user: current_user_dep
):
    """Разбор: ответ ученика и правильный ответ по каждому вопросу."""
    sa = await get_own_section_attempt(session, section_attempt_id, current_user, READING)
    return await question_section_result(session, sa)
