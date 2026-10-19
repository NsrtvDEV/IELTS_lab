"""Speaking: вопросы секции, записи ответов, результат и оценка преподавателем."""

from fastapi import HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import notifications
from app.config import settings
from app.media import AUDIO_TYPES, audio_duration, file_type, media_path, store
from app.models import (
    SectionAttempt,
    SpeakingAssessment,
    SpeakingResponse,
    SpeakingTask,
    User,
    UserRole,
)
from app.schemas.speaking import (
    SpeakingAssessmentIn,
    SpeakingAssessmentOut,
    SpeakingContent,
    SpeakingRecording,
    SpeakingResult,
    SpeakingTaskOut,
    SpeakingTaskResult,
    TeacherSpeakingTask,
)
from app.scoring import criteria_band, section_deadline, update_attempt_status
from app.writing import grader_names

# подготовка и длина ответа по умолчанию, секунды: Part 2 — минута на карточку и до 2 минут речи
SPEAKING_DEFAULTS = {1: (0, 30), 2: (60, 120), 3: (0, 60)}
RECORDINGS = "recordings"  # папка в MEDIA_ROOT; наружу не раздаётся — только через API
# тип по расширению: первый из AUDIO_TYPES (mimetypes считает .webm видео)
MEDIA_TYPES = {ext: mime for mime, ext in reversed(AUDIO_TYPES.items())}


def task_out(task: SpeakingTask) -> SpeakingTaskOut:
    prep, speak = SPEAKING_DEFAULTS[task.part]
    return SpeakingTaskOut(
        id=task.id,
        part=task.part,
        position=task.position,
        prompt=task.prompt,
        cue_card_points=task.cue_card_points or [],
        prep_time_sec=prep if task.prep_time_sec is None else task.prep_time_sec,
        speak_time_sec=task.speak_time_sec or speak,
    )


def teacher_task_out(task: SpeakingTask) -> TeacherSpeakingTask:
    return TeacherSpeakingTask(**task_out(task).model_dump(), sample_answer=task.sample_answer)


async def section_tasks(session: AsyncSession, section_id: int) -> list[SpeakingTask]:
    """Вопросы в порядке экзамена: Part 1 → Part 2 → Part 3."""
    return list(
        await session.scalars(
            select(SpeakingTask)
            .where(SpeakingTask.section_id == section_id)
            .order_by(SpeakingTask.part, SpeakingTask.position, SpeakingTask.id)
        )
    )


async def responses_by_task(session: AsyncSession, sa_id: int) -> dict[int, SpeakingResponse]:
    rows = await session.scalars(select(SpeakingResponse).where(SpeakingResponse.section_attempt_id == sa_id))
    return {r.task_id: r for r in rows}


async def speaking_content(session: AsyncSession, sa: SectionAttempt) -> SpeakingContent:
    tasks = await section_tasks(session, sa.section_id)
    responses = await responses_by_task(session, sa.id)
    return SpeakingContent(
        section_attempt_id=sa.id,
        attempt_id=sa.attempt_id,
        deadline=section_deadline(sa),
        tasks=[task_out(t) for t in tasks],
        answered_task_ids=[t.id for t in tasks if t.id in responses],
    )


async def save_recording(
    session: AsyncSession, sa: SectionAttempt, task_id: int, file: UploadFile, duration_sec: int | None
) -> SpeakingRecording:
    """Запись ответа на вопрос. Перезаписать нельзя — как на экзамене, ответ даётся один раз."""
    task = await session.get(SpeakingTask, task_id)
    if not task or task.section_id != sa.section_id:
        raise HTTPException(status_code=404, detail="Speaking question not found")
    exists = await session.scalar(
        select(SpeakingResponse.id).where(
            SpeakingResponse.section_attempt_id == sa.id, SpeakingResponse.task_id == task.id
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="This question is already answered")
    extension = AUDIO_TYPES.get(file_type(file))
    if not extension:
        raise HTTPException(status_code=415, detail="Unsupported audio format")

    url = await store(file, RECORDINGS, extension, settings.MAX_AUDIO_SIZE_MB)
    # из файла, если формат это позволяет (webm из браузера длину не хранит) — иначе со слов клиента
    duration = await audio_duration(url) or duration_sec
    response = SpeakingResponse(
        section_attempt_id=sa.id,
        task_id=task.id,
        audio_url=url,
        duration_sec=min(duration, 600) if duration is not None else None,
    )
    session.add(response)
    try:
        await session.commit()
    except IntegrityError:  # тот же ответ пришёл дважды одновременно
        await session.rollback()
        await remove_recording(url)
        raise HTTPException(status_code=409, detail="This question is already answered") from None
    return SpeakingRecording(task_id=task.id, response_id=response.id, duration_sec=response.duration_sec)


async def remove_recording(url: str | None) -> None:
    path = media_path(url)
    if path:
        await run_in_threadpool(path.unlink, missing_ok=True)


async def recording_file(session: AsyncSession, response_id: int, user: User) -> FileResponse:
    """Запись ответа слушают только сам ученик и преподаватели."""
    response = await session.get(SpeakingResponse, response_id)
    sa = await session.get(SectionAttempt, response.section_attempt_id) if response else None
    is_teacher = user.role in (UserRole.TEACHER, UserRole.ADMIN)
    if not sa or not (is_teacher or sa.attempt.user_id == user.id):
        raise HTTPException(status_code=404, detail="Recording not found")
    path = media_path(response.audio_url)
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="Recording file is missing")
    return FileResponse(path, media_type=MEDIA_TYPES.get(path.suffix, "application/octet-stream"))


async def latest_teacher_assessment(session: AsyncSession, sa_id: int) -> SpeakingAssessment | None:
    return await session.scalar(
        select(SpeakingAssessment)
        .where(SpeakingAssessment.section_attempt_id == sa_id)
        .order_by(SpeakingAssessment.created_at.desc(), SpeakingAssessment.id.desc())
        .limit(1)
    )


async def speaking_result(session: AsyncSession, sa: SectionAttempt) -> SpeakingResult:
    if not sa.submitted_at:
        raise HTTPException(status_code=409, detail="Section is not submitted yet")
    tasks = await section_tasks(session, sa.section_id)
    responses = await responses_by_task(session, sa.id)
    a = await latest_teacher_assessment(session, sa.id)
    names = await grader_names(session, {a.grader_id} if a and a.grader_id else set())

    return SpeakingResult(
        section_attempt_id=sa.id,
        attempt_id=sa.attempt_id,
        test_title=sa.attempt.test.title,
        submitted_at=sa.submitted_at,
        time_spent_sec=sa.time_spent_sec,
        band_score=sa.band_score,
        status="assessed" if sa.band_score is not None else "pending",
        tasks=[
            SpeakingTaskResult(
                **teacher_task_out(t).model_dump(),
                response_id=responses[t.id].id if t.id in responses else None,
                duration_sec=responses[t.id].duration_sec if t.id in responses else None,
            )
            for t in tasks
        ],
        assessment=SpeakingAssessmentOut(
            fluency_coherence=a.fluency_coherence,
            lexical_resource=a.lexical_resource,
            grammatical_range=a.grammatical_range,
            pronunciation=a.pronunciation,
            band=a.band,
            feedback=a.feedback,
            grader_name=names.get(a.grader_id),
            created_at=a.created_at,
        )
        if a
        else None,
    )


async def assess(session: AsyncSession, sa: SectionAttempt, teacher: User, data: SpeakingAssessmentIn) -> None:
    """Оценка всей секции по 4 критериям; band — их среднее. Повторная оценка заменяет прежнюю."""
    updated = sa.band_score is not None  # уже оценивали — ученику «оценка изменена»
    band = criteria_band(data.fluency_coherence, data.lexical_resource, data.grammatical_range, data.pronunciation)
    session.add(
        SpeakingAssessment(
            section_attempt_id=sa.id,
            grader_id=teacher.id,
            fluency_coherence=data.fluency_coherence,
            lexical_resource=data.lexical_resource,
            grammatical_range=data.grammatical_range,
            pronunciation=data.pronunciation,
            band=band,
            feedback=data.feedback or None,
        )
    )
    sa.band_score = band
    await update_attempt_status(session, sa.attempt)
    await notifications.work_assessed(session, sa, updated=updated)
    await session.commit()
