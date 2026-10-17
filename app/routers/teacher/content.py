"""Содержимое секций: тексты/аудио и вопросы (Reading, Listening), задания Writing, вопросы Speaking."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, func, select

from app.content import (
    build_group,
    ensure_editable,
    ensure_question_section,
    get_section,
    group_response,
    load_groups,
    section_content,
    validate_group,
)
from app.database import db_dep
from app.media import audio_duration, remove_unused
from app.dependencies import teacher_dep
from app.models import Passage, QuestionGroup, Section, SectionType, SpeakingTask, WritingTask
from app.schemas.speaking import SpeakingTaskCreate, SpeakingTaskUpdate, TeacherSpeakingTask
from app.schemas.writing import WritingTaskCreate, WritingTaskOut, WritingTaskUpdate
from app.speaking import teacher_task_out
from app.schemas.teacher import (
    PassageCreate,
    PassageUpdate,
    QuestionGroupCreate,
    SectionUpdate,
    TeacherPassage,
    TeacherQuestionGroup,
    TeacherSectionContent,
)

router = APIRouter(prefix="/teacher", tags=["Teacher: content"])


# ───────────────────────── Sections ─────────────────────────


@router.get("/sections/{section_id}", response_model=TeacherSectionContent)
async def get_section_content(section_id: int, session: db_dep, teacher: teacher_dep):
    """Тексты, вопросы и правильные ответы секции."""
    section, _ = await get_section(session, section_id)
    return await section_content(session, section)


@router.patch("/sections/{section_id}", response_model=TeacherSectionContent)
async def update_section(
    section_id: int, session: db_dep, teacher: teacher_dep, data: SectionUpdate
):
    section, test = await get_section(session, section_id)
    await ensure_editable(session, test)
    section.duration_min = data.duration_min
    await session.commit()
    return await section_content(session, section)


# ───────────────────────── Passages ─────────────────────────


async def editable_question_section(session, section_id: int) -> Section:
    section, test = await get_section(session, section_id)
    ensure_question_section(section)
    await ensure_editable(session, test)
    return section


async def editable_passage(session, passage_id: int) -> Passage:
    passage = await session.get(Passage, passage_id)
    if not passage:
        raise HTTPException(status_code=404, detail="Passage not found")
    _, test = await get_section(session, passage.section_id)
    await ensure_editable(session, test)
    return passage


@router.post(
    "/sections/{section_id}/passages", response_model=TeacherPassage, status_code=201
)
async def create_passage(
    section_id: int, session: db_dep, teacher: teacher_dep, data: PassageCreate
):
    """Reading — текст (Passage 1–3), Listening — аудио части (Part 1–4)."""
    section = await editable_question_section(session, section_id)
    passage = Passage(section_id=section.id, **data.model_dump())
    passage.audio_duration_sec = await audio_duration(passage.audio_url)
    session.add(passage)
    await session.commit()
    await session.refresh(passage)
    return passage


@router.patch("/passages/{passage_id}", response_model=TeacherPassage)
async def update_passage(
    passage_id: int, session: db_dep, teacher: teacher_dep, data: PassageUpdate
):
    passage = await editable_passage(session, passage_id)
    old_audio = passage.audio_url
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "position" and value is None:
            continue
        setattr(passage, field, value)
    if passage.audio_url != old_audio:
        passage.audio_duration_sec = await audio_duration(passage.audio_url)
    await session.commit()
    await remove_unused(session, [old_audio])  # заменённая запись больше не нужна
    await session.refresh(passage)
    return passage


@router.delete("/passages/{passage_id}", status_code=204)
async def delete_passage(passage_id: int, session: db_dep, teacher: teacher_dep):
    """Группы вопросов к этому тексту остаются, но теряют привязку к нему."""
    passage = await editable_passage(session, passage_id)
    audio = passage.audio_url
    await session.execute(delete(Passage).where(Passage.id == passage.id))
    await session.commit()
    await remove_unused(session, [audio])


# ───────────────────────── Question groups ─────────────────────────


async def editable_group(session, group_id: int) -> tuple[QuestionGroup, Section]:
    group = await session.get(QuestionGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Question group not found")
    section, test = await get_section(session, group.section_id)
    await ensure_editable(session, test)
    return group, section


async def saved_group(session, group_id: int) -> TeacherQuestionGroup:
    (group,) = await load_groups(session, id=group_id)
    return group_response(group)


@router.post(
    "/sections/{section_id}/question-groups",
    response_model=TeacherQuestionGroup,
    status_code=201,
)
async def create_question_group(
    section_id: int, session: db_dep, teacher: teacher_dep, data: QuestionGroupCreate
):
    """Группа вопросов целиком: инструкция, варианты, вопросы и правильные ответы.

    Правильные варианты указываются буквами (`correct_options: ["A"]`), текстовые
    ответы — списком допустимых написаний (`correct_texts: ["colour", "color"]`).
    Для TFNG/YNNG варианты TRUE/FALSE/NOT GIVEN (YES/NO/NOT GIVEN) создаются сами.
    """
    section = await editable_question_section(session, section_id)
    await validate_group(session, section, data)

    group = build_group(section, data)
    session.add(group)
    await session.commit()
    return await saved_group(session, group.id)


@router.put("/question-groups/{group_id}", response_model=TeacherQuestionGroup)
async def replace_question_group(
    group_id: int, session: db_dep, teacher: teacher_dep, data: QuestionGroupCreate
):
    """Заменить группу целиком — как создание, но на месте старой."""
    old, section = await editable_group(session, group_id)
    await validate_group(session, section, data, replacing_group_id=old.id)

    old_image = old.image_url
    await session.execute(delete(QuestionGroup).where(QuestionGroup.id == old.id))
    session.expunge(old)
    group = build_group(section, data)
    session.add(group)
    await session.commit()
    await remove_unused(session, [old_image])
    return await saved_group(session, group.id)


@router.delete("/question-groups/{group_id}", status_code=204)
async def delete_question_group(group_id: int, session: db_dep, teacher: teacher_dep):
    group, _ = await editable_group(session, group_id)
    image = group.image_url
    await session.execute(delete(QuestionGroup).where(QuestionGroup.id == group.id))
    await session.commit()
    await remove_unused(session, [image])



# ───────────────────────── Writing tasks ─────────────────────────

WRITING_DEFAULTS = {1: (150, 20), 2: (250, 40)}  # минимум слов, рекомендуемые минуты


async def editable_writing_task(session, task_id: int) -> WritingTask:
    task = await session.get(WritingTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Writing task not found")
    _, test = await get_section(session, task.section_id)
    await ensure_editable(session, test)
    return task


@router.post("/sections/{section_id}/writing-tasks", response_model=WritingTaskOut, status_code=201)
async def create_writing_task(
    section_id: int, session: db_dep, teacher: teacher_dep, data: WritingTaskCreate
):
    """Task 1 (график/таблица/процесс, 150+ слов) или Task 2 (эссе, 250+ слов)."""
    section, test = await get_section(session, section_id)
    if section.type != SectionType.WRITING:
        raise HTTPException(status_code=400, detail=f"{section.type} section has no writing tasks")
    await ensure_editable(session, test)
    exists = await session.scalar(
        select(WritingTask.id).where(
            WritingTask.section_id == section.id, WritingTask.task_number == data.task_number
        )
    )
    if exists:
        raise HTTPException(status_code=400, detail=f"Task {data.task_number} already exists — edit it instead")

    min_words, minutes = WRITING_DEFAULTS[data.task_number]
    task = WritingTask(
        section_id=section.id,
        task_number=data.task_number,
        prompt=data.prompt,
        image_url=data.image_url,
        min_words=data.min_words or min_words,
        recommended_min=data.recommended_min or minutes,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


@router.patch("/writing-tasks/{task_id}", response_model=WritingTaskOut)
async def update_writing_task(task_id: int, session: db_dep, teacher: teacher_dep, data: WritingTaskUpdate):
    task = await editable_writing_task(session, task_id)
    old_image = task.image_url
    for field, value in data.model_dump(exclude_unset=True).items():
        if field != "image_url" and value is None:
            continue  # обязательные поля не стираем
        setattr(task, field, value)
    await session.commit()
    if task.image_url != old_image:
        await remove_unused(session, [old_image])
    await session.refresh(task)
    return task


@router.delete("/writing-tasks/{task_id}", status_code=204)
async def delete_writing_task(task_id: int, session: db_dep, teacher: teacher_dep):
    task = await editable_writing_task(session, task_id)
    image = task.image_url
    await session.execute(delete(WritingTask).where(WritingTask.id == task.id))
    await session.commit()
    await remove_unused(session, [image])


# ───────────────────────── Speaking questions ─────────────────────────


async def editable_speaking_task(session, task_id: int) -> SpeakingTask:
    task = await session.get(SpeakingTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Speaking question not found")
    _, test = await get_section(session, task.section_id)
    await ensure_editable(session, test)
    return task


@router.post("/sections/{section_id}/speaking-tasks", response_model=TeacherSpeakingTask, status_code=201)
async def create_speaking_task(
    section_id: int, session: db_dep, teacher: teacher_dep, data: SpeakingTaskCreate
):
    """Part 1 и Part 3 — вопросы (по одному), Part 2 — одна карточка с пунктами; у каждого — примерный ответ."""
    section, test = await get_section(session, section_id)
    if section.type != SectionType.SPEAKING:
        raise HTTPException(status_code=400, detail=f"{section.type} section has no speaking questions")
    await ensure_editable(session, test)
    in_part = select(SpeakingTask).where(SpeakingTask.section_id == section.id, SpeakingTask.part == data.part)
    if data.part == 2 and await session.scalar(in_part.with_only_columns(SpeakingTask.id).limit(1)):
        raise HTTPException(status_code=400, detail="Part 2 already has a cue card — edit it instead")
    if data.part != 2 and data.cue_card_points:
        raise HTTPException(status_code=400, detail="Only the Part 2 cue card has points")

    last = await session.scalar(in_part.with_only_columns(func.max(SpeakingTask.position)))
    task = SpeakingTask(
        section_id=section.id,
        part=data.part,
        position=data.position if data.position is not None else (last + 1 if last is not None else 0),
        prompt=data.prompt,
        cue_card_points=data.cue_card_points or None,
        prep_time_sec=data.prep_time_sec,
        speak_time_sec=data.speak_time_sec,
        sample_answer=data.sample_answer or None,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return teacher_task_out(task)


@router.patch("/speaking-tasks/{task_id}", response_model=TeacherSpeakingTask)
async def update_speaking_task(task_id: int, session: db_dep, teacher: teacher_dep, data: SpeakingTaskUpdate):
    task = await editable_speaking_task(session, task_id)
    changes = data.model_dump(exclude_unset=True)
    if task.part != 2 and changes.get("cue_card_points"):
        raise HTTPException(status_code=400, detail="Only the Part 2 cue card has points")
    for field, value in changes.items():
        if field in ("prompt", "position") and value is None:
            continue  # обязательные поля не стираем
        if field in ("cue_card_points", "sample_answer"):
            value = value or None  # пустой список/текст — значения нет
        setattr(task, field, value)
    await session.commit()
    await session.refresh(task)
    return teacher_task_out(task)


@router.delete("/speaking-tasks/{task_id}", status_code=204)
async def delete_speaking_task(task_id: int, session: db_dep, teacher: teacher_dep):
    task = await editable_speaking_task(session, task_id)
    await session.execute(delete(SpeakingTask).where(SpeakingTask.id == task.id))
    await session.commit()
