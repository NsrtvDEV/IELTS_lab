"""Создание и проверка содержимого тестов (используется роутерами учителя)."""

from fastapi import HTTPException
from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    CorrectAnswer,
    IeltsTest,
    Passage,
    Question,
    QuestionGroup,
    QuestionOption,
    QuestionType,
    Section,
    SectionType,
    SpeakingTask,
    TestAttempt,
    WritingTask,
)
from app.schemas.teacher import (
    QuestionGroupCreate,
    TeacherQuestion,
    TeacherQuestionGroup,
    TeacherSection,
    TeacherSectionContent,
    TeacherTest,
)

# стандартное время секций IELTS Academic, минуты
DEFAULT_SECTIONS = [
    (SectionType.LISTENING, 30),
    (SectionType.READING, 60),
    (SectionType.WRITING, 60),
    (SectionType.SPEAKING, 14),
]
QUESTION_SECTIONS = {SectionType.LISTENING, SectionType.READING}
QUESTIONS_PER_SECTION = 40

# ответ — выбор варианта
OPTION_TYPES = {
    QuestionType.MCQ,
    QuestionType.MCQ_MULTI,
    QuestionType.TFNG,
    QuestionType.YNNG,
    QuestionType.MATCHING_HEADINGS,
    QuestionType.MATCHING_INFO,
    QuestionType.MATCHING_FEATURES,
    QuestionType.MATCHING_SENTENCE_ENDINGS,
}
# ответ — слова или выбор из списка (буквы на схеме, "choose from the box" в summary)
EITHER_TYPES = {
    QuestionType.DIAGRAM_LABEL,
    QuestionType.MAP_LABEL,
    QuestionType.SUMMARY_COMPLETION,
    QuestionType.NOTE_COMPLETION,
    QuestionType.TABLE_COMPLETION,
    QuestionType.FLOW_CHART_COMPLETION,
    QuestionType.SENTENCE_COMPLETION,
    QuestionType.GAP_FILL,
}
# варианты, которые создаются сами, если учитель их не прислал
DEFAULT_GROUP_OPTIONS = {
    QuestionType.TFNG: [("TRUE", "True"), ("FALSE", "False"), ("NOT GIVEN", "Not given")],
    QuestionType.YNNG: [("YES", "Yes"), ("NO", "No"), ("NOT GIVEN", "Not given")],
}


def bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


# ───────────────────────── Tests ─────────────────────────


async def get_test(session: AsyncSession, test_id: int) -> IeltsTest:
    test = await session.get(IeltsTest, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


async def has_attempts(session: AsyncSession, test_id: int) -> bool:
    return bool(await session.scalar(select(exists().where(TestAttempt.test_id == test_id))))


async def ensure_editable(session: AsyncSession, test: IeltsTest) -> None:
    """Менять содержимое можно только у неопубликованного теста без попыток.

    Иначе правка вопросов испортила бы уже сданные ответы и результаты учеников.
    """
    if test.is_published:
        raise HTTPException(status_code=409, detail="Unpublish the test before editing")
    if await has_attempts(session, test.id):
        raise HTTPException(
            status_code=409, detail="Students already took this test — it can't be edited"
        )


async def question_counts(session: AsyncSession, section_ids: list[int]) -> dict[int, int]:
    rows = await session.execute(
        select(QuestionGroup.section_id, func.count(Question.id))
        .join(Question, Question.group_id == QuestionGroup.id)
        .where(QuestionGroup.section_id.in_(section_ids))
        .group_by(QuestionGroup.section_id)
    )
    return dict(rows.all())


async def test_problems(session: AsyncSession, test: IeltsTest) -> list[str]:
    """Что мешает публикации (раздел 2.10 TZ.md)."""
    problems = []
    sections = {s.type: s for s in test.sections}
    for section_type in SectionType:
        if section_type not in sections:
            problems.append(f"{section_type}: section is missing")

    counts = await question_counts(session, [s.id for s in test.sections])
    for section_type in QUESTION_SECTIONS:
        section = sections.get(section_type)
        if not section:
            continue
        count = counts.get(section.id, 0)
        if count != QUESTIONS_PER_SECTION:
            problems.append(f"{section_type}: {count} questions instead of {QUESTIONS_PER_SECTION}")
        without_answer = (
            await session.scalars(
                select(Question.number)
                .join(Question.group)
                .where(
                    QuestionGroup.section_id == section.id,
                    ~exists().where(CorrectAnswer.question_id == Question.id),
                )
                .order_by(Question.number)
            )
        ).all()
        if without_answer:
            problems.append(f"{section_type}: no correct answer for questions {list(without_answer)}")

    if writing := sections.get(SectionType.WRITING):
        numbers = set(
            await session.scalars(
                select(WritingTask.task_number).where(WritingTask.section_id == writing.id)
            )
        )
        if numbers != {1, 2}:
            problems.append("writing: Task 1 and Task 2 are required")

    if speaking := sections.get(SectionType.SPEAKING):
        parts = set(
            await session.scalars(
                select(SpeakingTask.part).where(SpeakingTask.section_id == speaking.id)
            )
        )
        if parts != {1, 2, 3}:
            problems.append("speaking: Part 1, 2 and 3 are required")

    return problems


async def test_response(session: AsyncSession, test: IeltsTest) -> TeacherTest:
    counts = await question_counts(session, [s.id for s in test.sections])
    return TeacherTest(
        id=test.id,
        title=test.title,
        is_published=test.is_published,
        created_at=test.created_at,
        updated_at=test.updated_at,
        sections=[
            TeacherSection(
                id=s.id,
                type=s.type,
                duration_min=s.duration_min,
                question_count=counts.get(s.id, 0),
            )
            for s in test.sections
        ],
        has_attempts=await has_attempts(session, test.id),
        problems=await test_problems(session, test),
    )


# ───────────────────────── Sections ─────────────────────────


async def get_section(session: AsyncSession, section_id: int) -> tuple[Section, IeltsTest]:
    section = await session.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section, await session.get(IeltsTest, section.test_id)


def ensure_question_section(section: Section) -> None:
    if section.type not in QUESTION_SECTIONS:
        raise bad_request(f"{section.type} section has no passages and questions")


async def load_groups(session: AsyncSession, **where) -> list[QuestionGroup]:
    stmt = select(QuestionGroup).options(
        selectinload(QuestionGroup.questions)
        .selectinload(Question.correct_answers)
        .selectinload(CorrectAnswer.option)
    )
    for column, value in where.items():
        stmt = stmt.where(getattr(QuestionGroup, column) == value)
    return list(await session.scalars(stmt.order_by(QuestionGroup.position, QuestionGroup.id)))


def group_response(group: QuestionGroup) -> TeacherQuestionGroup:
    return TeacherQuestionGroup(
        id=group.id,
        passage_id=group.passage_id,
        type=group.type,
        instruction=group.instruction,
        word_limit=group.word_limit,
        allow_number=group.allow_number,
        position=group.position,
        image_url=group.image_url,
        meta=group.meta,
        options=group.options,
        questions=[
            TeacherQuestion(
                id=q.id,
                number=q.number,
                text=q.text,
                answers_required=q.answers_required,
                points=q.points,
                meta=q.meta,
                options=q.options,
                correct_options=[c.option.label for c in q.correct_answers if c.option],
                correct_texts=[c.answer_text for c in q.correct_answers if c.answer_text],
            )
            for q in group.questions
        ],
    )


async def section_content(session: AsyncSession, section: Section) -> TeacherSectionContent:
    passages = await session.scalars(
        select(Passage).where(Passage.section_id == section.id).order_by(Passage.position)
    )
    groups = await load_groups(session, section_id=section.id)
    return TeacherSectionContent(
        id=section.id,
        test_id=section.test_id,
        type=section.type,
        duration_min=section.duration_min,
        passages=list(passages),
        question_groups=[group_response(g) for g in groups],
        question_numbers=sorted(q.number for g in groups for q in g.questions),
    )


# ───────────────────────── Question groups ─────────────────────────


async def validate_group(
    session: AsyncSession,
    section: Section,
    data: QuestionGroupCreate,
    replacing_group_id: int | None = None,
) -> None:
    if data.passage_id is not None:
        passage = await session.get(Passage, data.passage_id)
        if not passage or passage.section_id != section.id:
            raise bad_request("Passage is not in this section")

    numbers = [q.number for q in data.questions]
    if len(numbers) != len(set(numbers)):
        raise bad_request("Question numbers in the group must be unique")
    taken_stmt = (
        select(Question.number)
        .join(Question.group)
        .where(QuestionGroup.section_id == section.id, Question.number.in_(numbers))
    )
    if replacing_group_id is not None:
        taken_stmt = taken_stmt.where(QuestionGroup.id != replacing_group_id)
    taken = sorted(set(await session.scalars(taken_stmt)))
    if taken:
        raise bad_request(f"Question numbers already used in this section: {taken}")

    group_labels = [o.label for o in data.options]
    if len(group_labels) != len(set(group_labels)):
        raise bad_request("Option labels in the group must be unique")
    if data.word_limit and data.type in OPTION_TYPES:
        raise bad_request("word_limit is only for questions answered with text")

    for q in data.questions:
        labels = [o.label for o in q.options]
        if len(labels) != len(set(labels)):
            raise bad_request(f"Q{q.number}: option labels must be unique")
        if set(labels) & set(group_labels):
            raise bad_request(f"Q{q.number}: option labels clash with group options")
        if bool(q.correct_options) == bool(q.correct_texts):
            raise bad_request(f"Q{q.number}: give either correct_options or correct_texts")

        if q.correct_options:
            if data.type not in OPTION_TYPES | EITHER_TYPES:
                raise bad_request(f"Q{q.number}: {data.type} is answered with text — use correct_texts")
            available = set(labels) | set(group_labels)
            if data.type in DEFAULT_GROUP_OPTIONS and not data.options:
                available |= {label for label, _ in DEFAULT_GROUP_OPTIONS[data.type]}
            unknown = set(q.correct_options) - available
            if unknown:
                raise bad_request(f"Q{q.number}: unknown option labels {sorted(unknown)}")
            expected = q.answers_required if data.type == QuestionType.MCQ_MULTI else 1
            if len(set(q.correct_options)) != expected:
                raise bad_request(f"Q{q.number}: exactly {expected} correct option(s) required")
        elif data.type in OPTION_TYPES:
            raise bad_request(f"Q{q.number}: {data.type} needs correct_options")

        if q.answers_required > 1 and data.type != QuestionType.MCQ_MULTI:
            raise bad_request(f"Q{q.number}: answers_required > 1 is only for {QuestionType.MCQ_MULTI}")


def build_group(section: Section, data: QuestionGroupCreate) -> QuestionGroup:
    """Группа со всеми вопросами, вариантами и правильными ответами (ещё не сохранена)."""
    group = QuestionGroup(
        section_id=section.id,
        passage_id=data.passage_id,
        type=data.type,
        instruction=data.instruction,
        word_limit=data.word_limit,
        allow_number=data.allow_number,
        position=data.position,
        image_url=data.image_url,
        meta=data.meta,
        options=[],
        questions=[],
    )
    options = [(o.label, o.text) for o in data.options] or DEFAULT_GROUP_OPTIONS.get(data.type, [])
    for i, (label, text) in enumerate(options):
        group.options.append(QuestionOption(label=label, text=text, position=i))

    by_label = {o.label: o for o in group.options}
    for q in sorted(data.questions, key=lambda q: q.number):
        question = Question(
            number=q.number,
            text=q.text,
            answers_required=q.answers_required,
            points=q.points or q.answers_required,
            meta=q.meta,
            options=[
                QuestionOption(label=o.label, text=o.text, position=i)
                for i, o in enumerate(q.options)
            ],
            correct_answers=[],
        )
        own = {o.label: o for o in question.options}
        for label in dict.fromkeys(q.correct_options):
            question.correct_answers.append(CorrectAnswer(option=own.get(label) or by_label[label]))
        for text in dict.fromkeys(q.correct_texts):
            question.correct_answers.append(CorrectAnswer(answer_text=text))
        group.questions.append(question)

    return group
