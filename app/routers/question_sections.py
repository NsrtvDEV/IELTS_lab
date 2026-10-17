"""Эндпоинты прохождения секций с вопросами — одинаковые для Reading и Listening."""

from fastapi import APIRouter

from app.database import db_dep
from app.dependencies import current_user_dep
from app.models import SectionType
from app.schemas.attempts import SectionAttemptShort
from app.schemas.questions import (
    AnswersSave,
    PlaybackState,
    QuestionSectionContent,
    QuestionSectionResult,
)
from app.sections import (
    get_open_section_attempt,
    get_own_attempt,
    get_own_section_attempt,
    question_section_content,
    question_section_result,
    save_playback,
    save_question_answers,
    start_section,
    submit,
)


def make_router(section_type: SectionType, about: str) -> APIRouter:
    name = section_type.value.capitalize()
    router = APIRouter(prefix=f"/{section_type.value}", tags=[name])

    @router.post("/attempts/{attempt_id}/start", response_model=QuestionSectionContent)
    async def start(attempt_id: int, session: db_dep, current_user: current_user_dep):
        attempt = await get_own_attempt(session, attempt_id, current_user)
        sa = await start_section(session, attempt, section_type)
        return await question_section_content(session, sa)

    start.__doc__ = f"Начать {name} (или продолжить начатый): {about}."

    @router.get("/{section_attempt_id}", response_model=QuestionSectionContent)
    async def get_content(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
        """Содержимое секции и сохранённые ответы — пока секция не сдана."""
        sa = await get_open_section_attempt(session, section_attempt_id, current_user, section_type)
        return await question_section_content(session, sa)

    @router.put("/{section_attempt_id}/answers", status_code=204)
    async def save_answers(
        section_attempt_id: int, session: db_dep, current_user: current_user_dep, data: AnswersSave
    ):
        """Автосохранение ответов: можно присылать все ответы или только изменённые."""
        sa = await get_open_section_attempt(session, section_attempt_id, current_user, section_type)
        await save_question_answers(session, sa, data.answers)

    if section_type == SectionType.LISTENING:

        @router.put("/{section_attempt_id}/playback", response_model=PlaybackState)
        async def playback(
            section_attempt_id: int, session: db_dep, current_user: current_user_dep, data: PlaybackState
        ):
            """Место воспроизведения записи; принимается только движение вперёд."""
            sa = await get_open_section_attempt(session, section_attempt_id, current_user, section_type)
            return await save_playback(session, sa, data)

    @router.post("/{section_attempt_id}/submit", response_model=SectionAttemptShort)
    async def submit_section(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
        """Сдать секцию: ответы проверяются сразу, raw score переводится в band."""
        sa = await get_own_section_attempt(session, section_attempt_id, current_user, section_type)
        return await submit(session, sa)

    @router.get("/{section_attempt_id}/result", response_model=QuestionSectionResult)
    async def result(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
        """Разбор: ответ ученика и правильный ответ по каждому вопросу."""
        sa = await get_own_section_attempt(session, section_attempt_id, current_user, section_type)
        return await question_section_result(session, sa)

    return router
