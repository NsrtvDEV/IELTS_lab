from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile

from app.database import db_dep
from app.dependencies import current_user_dep
from app.models import SectionType
from app.schemas.attempts import SectionAttemptShort
from app.schemas.speaking import SpeakingContent, SpeakingRecording, SpeakingResult
from app.sections import (
    get_open_section_attempt,
    get_own_attempt,
    get_own_section_attempt,
    start_section,
    submit,
)
from app.speaking import recording_file, save_recording, speaking_content, speaking_result

router = APIRouter(prefix="/speaking", tags=["Speaking"])

SPEAKING = SectionType.SPEAKING


@router.post("/attempts/{attempt_id}/start", response_model=SpeakingContent)
async def start_speaking(attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Начать Speaking (или продолжить начатый): вопросы Part 1–3 по порядку."""
    attempt = await get_own_attempt(session, attempt_id, current_user)
    sa = await start_section(session, attempt, SPEAKING)
    return await speaking_content(session, sa)


@router.get("/recordings/{response_id}")
async def get_recording(response_id: int, session: db_dep, current_user: current_user_dep):
    """Аудио ответа — для самого ученика и преподавателей."""
    return await recording_file(session, response_id, current_user)


@router.get("/{section_attempt_id}", response_model=SpeakingContent)
async def get_speaking(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Вопросы и уже записанные ответы — пока секция не сдана."""
    sa = await get_open_section_attempt(session, section_attempt_id, current_user, SPEAKING)
    return await speaking_content(session, sa)


@router.post(
    "/{section_attempt_id}/tasks/{task_id}", response_model=SpeakingRecording, status_code=201
)
async def upload_answer(
    section_attempt_id: int,
    task_id: int,
    session: db_dep,
    current_user: current_user_dep,
    file: UploadFile = File(...),
    duration_sec: Annotated[int | None, Form(ge=0, le=600)] = None,
):
    """Запись ответа с микрофона (webm, ogg, m4a, mp3, wav); на каждый вопрос — один раз."""
    sa = await get_open_section_attempt(session, section_attempt_id, current_user, SPEAKING)
    return await save_recording(session, sa, task_id, file, duration_sec)


@router.post("/{section_attempt_id}/submit", response_model=SectionAttemptShort)
async def submit_speaking(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Сдать Speaking: записи уходят преподавателю на проверку."""
    sa = await get_own_section_attempt(session, section_attempt_id, current_user, SPEAKING)
    return await submit(session, sa)


@router.get("/{section_attempt_id}/result", response_model=SpeakingResult)
async def speaking_result_endpoint(section_attempt_id: int, session: db_dep, current_user: current_user_dep):
    """Вопросы с записями ответов и — после проверки — оценки по критериям и отзыв."""
    sa = await get_own_section_attempt(session, section_attempt_id, current_user, SPEAKING)
    return await speaking_result(session, sa)
