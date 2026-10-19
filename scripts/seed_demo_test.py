"""Демо-тест IELTS Academic со всеми четырьмя секциями — чтобы пройти платформу руками.

    uv run python scripts/seed_demo_test.py

Создаёт и публикует «Demo Test — IELTS Academic» в базе из .env:
Listening (4 записи, 40 вопросов), Reading (3 текста, 40 вопросов), Writing (Task 1 с графиком и Task 2),
Speaking (Part 1–3 с примерными ответами). Повторный запуск пересоздаёт тест, если его ещё никто не проходил.
Другие тесты и пользователей не трогает.
"""

import asyncio
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)  # .env и MEDIA_ROOT считаются от корня проекта, как у сервера
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts" / "demo"))

from listening import PARTS, transcript  # noqa: E402
from sqlalchemy import delete, select  # noqa: E402

from app import notifications  # noqa: E402
from app.config import settings  # noqa: E402
from app.content import DEFAULT_SECTIONS, build_group, has_attempts, test_problems, validate_group  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.media import audio_duration  # noqa: E402
from app.models import IeltsTest, Passage, Section, SectionType, SpeakingTask, WritingTask  # noqa: E402
from app.schemas.teacher import QuestionGroupCreate  # noqa: E402

TITLE = "Demo Test — IELTS Academic"
DEMO = ROOT / "scripts" / "demo"


def q(number, text=None, **kw):
    return {"number": number, "text": text, **kw}


def letters(*texts):
    return [{"label": chr(65 + i), "text": t} for i, t in enumerate(texts)]


# ───────────────────────── Listening ─────────────────────────

LISTENING_GROUPS = [
    [  # Part 1
        {
            "type": "form_completion",
            "instruction": "Questions 1–10\nComplete the form below.\nWrite ONE WORD AND/OR A NUMBER for each answer.",
            "word_limit": 1,
            "allow_number": True,
            "meta": {
                "template": (
                    "RIVERSIDE SPORTS CENTRE — Membership form\n"
                    "Name: Sarah {1}\n"
                    "Address: 42 {2} Road, {3}\n"
                    "Occupation: {4}\n"
                    "Type of membership: {5}\n"
                    "Monthly cost: £{6}\n"
                    "Main interest: {7}\n"
                    "Preferred day for classes: {8}\n"
                    "Heard about the centre from: an advert in the {9}\n"
                    "Start date: {10} June"
                )
            },
            "questions": [
                q(1, correct_texts=["Collins"]),
                q(2, correct_texts=["Park"]),
                q(3, correct_texts=["Greenfield"]),
                q(4, correct_texts=["nurse"]),
                q(5, correct_texts=["family"]),
                q(6, correct_texts=["45"]),
                q(7, correct_texts=["swimming"]),
                q(8, correct_texts=["Thursday"]),
                q(9, correct_texts=["newspaper"]),
                q(10, correct_texts=["3", "3rd", "third"]),
            ],
        },
    ],
    [  # Part 2
        {
            "type": "mcq",
            "instruction": "Questions 11–14\nChoose the correct letter, A, B or C.",
            "questions": [
                q(
                    11,
                    "The museum building was originally",
                    options=letters("a warehouse.", "a fish market.", "a shipyard."),
                    correct_options=["B"],
                ),
                q(
                    12,
                    "Most visitors spend",
                    options=letters(
                        "about one hour in the museum.", "about two hours in the museum.", "half a day in the museum."
                    ),
                    correct_options=["B"],
                ),
                q(
                    13,
                    "Children especially enjoy",
                    options=letters("building a boat.", "looking at old maps.", "the view from the café."),
                    correct_options=["A"],
                ),
                q(
                    14,
                    "Photographs are not allowed on the first floor because",
                    options=letters(
                        "the gallery is often crowded.",
                        "a flash could damage old maps.",
                        "the exhibits belong to private owners.",
                    ),
                    correct_options=["B"],
                ),
            ],
        },
        {
            "type": "note_completion",
            "instruction": "Questions 15–20\nComplete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer.",
            "word_limit": 1,
            "allow_number": True,
            "meta": {
                "template": (
                    "Visitor information\n"
                    "• Café: hot meals are served until {15} o'clock\n"
                    "• Student tickets: £{16}\n"
                    "• Free audio guides: collect from the {17} desk\n"
                    "• Lockers: next to the {18}\n"
                    "• Shop: postcards, books and model {19}\n"
                    "• Saturday workshop: learn to tie sailors' {20}"
                )
            },
            "questions": [
                q(15, correct_texts=["3", "three"]),
                q(16, correct_texts=["5", "five"]),
                q(17, correct_texts=["reception"]),
                q(18, correct_texts=["shop"]),
                q(19, correct_texts=["ships"]),
                q(20, correct_texts=["knots"]),
            ],
        },
    ],
    [  # Part 3
        {
            "type": "mcq",
            "instruction": "Questions 21–25\nChoose the correct letter, A, B or C.",
            "questions": [
                q(
                    21,
                    "The project must be finished by the end of",
                    options=letters("March.", "April.", "May."),
                    correct_options=["B"],
                ),
                q(
                    22,
                    "How many people will the students survey?",
                    options=letters("20", "30", "50"),
                    correct_options=["B"],
                ),
                q(
                    23,
                    "They will visit the gardens in the morning because",
                    options=letters("it is cooler then.", "more volunteers are there.", "the gardens close early."),
                    correct_options=["B"],
                ),
                q(
                    24,
                    "According to the article, the main benefit of community gardens is",
                    options=letters("cheaper vegetables.", "meeting neighbours.", "regular exercise."),
                    correct_options=["B"],
                ),
                q(
                    25,
                    "The biggest problem for the gardens is",
                    options=letters("a lack of water.", "theft.", "a lack of volunteers."),
                    correct_options=["A"],
                ),
            ],
        },
        {
            "type": "matching_features",
            "instruction": "Questions 26–30\nWho will do each task?\nChoose the correct letter, A, B or C.",
            "options": letters("Anna", "Tom", "Ben"),
            "questions": [
                q(26, "analyse the survey results", correct_options=["A"]),
                q(27, "take the photos", correct_options=["B"]),
                q(28, "write the introduction", correct_options=["B"]),
                q(29, "make the presentation slides", correct_options=["A"]),
                q(30, "write the bibliography", correct_options=["C"]),
            ],
        },
    ],
    [  # Part 4
        {
            "type": "note_completion",
            "instruction": "Questions 31–40\nComplete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer.",
            "word_limit": 1,
            "allow_number": True,
            "meta": {
                "template": (
                    "HONEY BEES\n"
                    "Colony\n"
                    "• up to {31} bees in one colony\n"
                    "• the {32} is the only bee that lays eggs\n"
                    "• in summer: about 2,000 eggs a {33}\n"
                    "Worker bees\n"
                    "• young bees clean the hive and feed the {34}\n"
                    "• older bees (foragers) collect nectar and {35}\n"
                    "Communication\n"
                    "• the waggle {36} shows where food is\n"
                    "• its direction is related to the position of the {37}\n"
                    "Importance\n"
                    "• about one {38} of our food depends on pollination\n"
                    "• e.g. apples and {39}\n"
                    "Threats\n"
                    "• pesticides, disease and the loss of wild {40}"
                )
            },
            "questions": [
                q(31, correct_texts=["60000", "60,000"]),
                q(32, correct_texts=["queen"]),
                q(33, correct_texts=["day"]),
                q(34, correct_texts=["larvae"]),
                q(35, correct_texts=["pollen"]),
                q(36, correct_texts=["dance"]),
                q(37, correct_texts=["sun"]),
                q(38, correct_texts=["third"]),
                q(39, correct_texts=["almonds"]),
                q(40, correct_texts=["flowers"]),
            ],
        },
    ],
]

# ───────────────────────── Reading ─────────────────────────

PASSAGE_1 = """Glass is one of the oldest materials made by humans. Historians believe that the first true glass was produced in Mesopotamia, in what is now Iraq, around 3,500 years ago. These early craftsmen did not make windows or bottles; instead they produced small beads, which were valued as highly as precious stones.

For many centuries glass objects were rare and expensive, because they had to be shaped around a core of sand and clay. This changed dramatically in the first century BC, when craftsmen in the Syrian region discovered glassblowing. By blowing air into molten glass through a long metal tube, a skilled worker could create a vessel in minutes rather than days. As a result, glass became cheap enough for ordinary people to use at home.

The Romans quickly adopted the new technique and spread it throughout their empire. Roman glassmakers were the first to produce clear glass windows, although these were thick and uneven and let in only a little light. After the fall of the Roman Empire, the centre of glassmaking moved to Venice. In 1291 the city authorities ordered all glassmakers to move to the island of Murano. The official reason was to protect the city from fires, but many historians think the real aim was to keep the secrets of the industry from competitors.

Venetian glass was famous across Europe for its clarity and colour. In the fifteenth century a glassmaker named Angelo Barovier invented cristallo, an almost completely transparent glass. However, it was an English producer who made the next great advance: in 1674 George Ravenscroft added lead oxide to the mixture and created a heavier, more brilliant glass that was ideal for cutting.

Today glass is made in enormous quantities by machines. Modern float glass, invented by Alastair Pilkington in the 1950s, is produced by pouring molten glass onto a bath of liquid tin, which gives it a perfectly flat surface. Nearly all the windows in modern buildings are made in this way."""

PASSAGE_2 = """A  For most of history, sleep was seen as a period of rest in which the brain simply switched off. Only in the twentieth century, with the invention of devices that could record electrical activity in the brain, did scientists realise how active the sleeping brain really is.

B  Sleep is made up of several stages that repeat in cycles of about ninety minutes. During deep sleep, brain waves become slow and regular, while during rapid eye movement (REM) sleep the brain is almost as active as when we are awake. Most vivid dreams take place during REM sleep.

C  Researchers now believe that one of the main functions of sleep is to strengthen memories. In a well-known experiment, volunteers learned a list of word pairs in the evening. Those who slept normally remembered twenty per cent more the next morning than those who were kept awake all night.

D  Different stages of sleep seem to help different kinds of memory. Deep sleep appears to be especially important for facts, such as names and dates, whereas REM sleep helps with skills, for example playing a musical instrument.

E  Even a short nap can be useful. A study at a German university found that a nap of just six minutes improved performance on a memory test, although longer naps produced greater benefits.

F  These findings have practical consequences for students. Staying up all night before an exam may seem like a good use of time, but it can actually make it harder to recall what has been learned. Experts recommend regular sleep and spreading study sessions over several days."""

PASSAGE_3 = """Anyone who has walked through a city centre on a summer afternoon knows that cities are hotter than the surrounding countryside. This effect, known as the urban heat island, can make a city up to seven degrees warmer than nearby rural areas, especially at night.

The main cause is the materials that cities are built from. Concrete, asphalt and brick absorb heat during the day and release it slowly after sunset. In addition, cities have far fewer trees and plants, which normally cool the air as water evaporates from their leaves. Heat from cars, air conditioners and factories adds further to the problem.

In my view, the urban heat island is one of the most underestimated threats to public health. During heatwaves, death rates rise sharply in cities, and elderly people are particularly at risk. Higher temperatures also increase the demand for air conditioning, which uses large amounts of electricity and, ironically, releases even more heat into the streets.

Fortunately, there are solutions, and many of them are surprisingly cheap. Painting roofs white so that they reflect sunlight can lower the temperature inside a building by several degrees. Planting trees along streets provides shade and cools the air. Some cities, such as Singapore, now require new buildings to include green roofs or walls covered with plants.

Not every measure is equally effective, however. Fountains and artificial lakes look attractive, but their cooling effect is limited to a very small area. I believe that city planners should focus first on trees, which offer the greatest benefit for the lowest cost.

Ultimately, tackling urban heat requires cooperation between governments, architects and residents. Individuals can help too: even a few plants on a balcony make a small contribution. As cities continue to grow, this issue will only become more urgent."""

READING = [
    (
        "The History of Glass",
        PASSAGE_1,
        [
            {
                "type": "tfng",
                "instruction": "Questions 1–7\nDo the following statements agree with the information given in Reading Passage 1?\nWrite TRUE, FALSE or NOT GIVEN.",
                "questions": [
                    q(1, "The first true glass was made in Mesopotamia.", correct_options=["TRUE"]),
                    q(2, "Early glass beads were considered as valuable as precious stones.", correct_options=["TRUE"]),
                    q(3, "Glassblowing was invented in Egypt.", correct_options=["FALSE"]),
                    q(4, "Glassblowing made glass objects more affordable.", correct_options=["TRUE"]),
                    q(5, "Roman windows let in as much light as modern windows.", correct_options=["FALSE"]),
                    q(6, "Glassmakers in Venice earned more than other craftsmen.", correct_options=["NOT GIVEN"]),
                    q(7, "Angelo Barovier sold most of his glass in England.", correct_options=["NOT GIVEN"]),
                ],
            },
            {
                "type": "sentence_completion",
                "instruction": "Questions 8–13\nComplete the sentences below.\nChoose NO MORE THAN TWO WORDS from the passage for each answer.",
                "word_limit": 2,
                "questions": [
                    q(
                        8,
                        "With glassblowing, a worker could make a vessel in ____ rather than days.",
                        correct_texts=["minutes"],
                    ),
                    q(9, "Roman glass windows were thick and ____.", correct_texts=["uneven"]),
                    q(10, "In 1291 glassmakers had to move to the island of ____.", correct_texts=["Murano"]),
                    q(
                        11,
                        "Officially, the move was meant to protect Venice from ____.",
                        correct_texts=["fires", "fire"],
                    ),
                    q(
                        12,
                        "Ravenscroft added ____ to make glass heavier and more brilliant.",
                        correct_texts=["lead oxide"],
                    ),
                    q(13, "Float glass is made by pouring molten glass onto liquid ____.", correct_texts=["tin"]),
                ],
            },
        ],
    ),
    (
        "Sleep and Memory",
        PASSAGE_2,
        [
            {
                "type": "matching_headings",
                "instruction": "Questions 14–19\nReading Passage 2 has six paragraphs, A–F.\nChoose the correct heading for each paragraph from the list of headings below.",
                "options": [
                    {"label": "i", "text": "A changing view of sleep"},
                    {"label": "ii", "text": "The structure of a night's sleep"},
                    {"label": "iii", "text": "Evidence that sleep improves memory"},
                    {"label": "iv", "text": "Why some people need less sleep"},
                    {"label": "v", "text": "Different stages, different memories"},
                    {"label": "vi", "text": "The value of short sleeps"},
                    {"label": "vii", "text": "Advice for learners"},
                    {"label": "viii", "text": "The dangers of sleeping pills"},
                ],
                "questions": [
                    q(14, "Paragraph A", correct_options=["i"]),
                    q(15, "Paragraph B", correct_options=["ii"]),
                    q(16, "Paragraph C", correct_options=["iii"]),
                    q(17, "Paragraph D", correct_options=["v"]),
                    q(18, "Paragraph E", correct_options=["vi"]),
                    q(19, "Paragraph F", correct_options=["vii"]),
                ],
            },
            {
                "type": "mcq",
                "instruction": "Questions 20–23\nChoose the correct letter, A, B or C.",
                "questions": [
                    q(
                        20,
                        "Scientists realised the sleeping brain is active after",
                        options=letters(
                            "studying people's dreams.",
                            "inventing devices that record brain activity.",
                            "experiments on animals.",
                        ),
                        correct_options=["B"],
                    ),
                    q(
                        21,
                        "A sleep cycle lasts about",
                        options=letters("60 minutes.", "90 minutes.", "120 minutes."),
                        correct_options=["B"],
                    ),
                    q(
                        22,
                        "In the word-pair experiment, people who slept normally remembered",
                        options=letters("10% more.", "20% more.", "twice as much."),
                        correct_options=["B"],
                    ),
                    q(
                        23,
                        "According to paragraph D, REM sleep mainly helps us remember",
                        options=letters("names.", "dates.", "skills."),
                        correct_options=["C"],
                    ),
                ],
            },
            {
                "type": "summary_completion",
                "instruction": "Questions 24–26\nComplete the summary below.\nChoose ONE WORD ONLY from the passage for each answer.",
                "word_limit": 1,
                "meta": {
                    "template": (
                        "A nap of only six {24} improved results in a memory test. Staying awake all night before an {25} "
                        "can make it harder to recall information. Experts recommend regular sleep and spreading study over several {26}."
                    )
                },
                "questions": [
                    q(24, correct_texts=["minutes"]),
                    q(25, correct_texts=["exam"]),
                    q(26, correct_texts=["days"]),
                ],
            },
        ],
    ),
    (
        "Cooling the Urban Heat Island",
        PASSAGE_3,
        [
            {
                "type": "ynng",
                "instruction": "Questions 27–31\nDo the following statements agree with the views of the writer in Reading Passage 3?\nWrite YES, NO or NOT GIVEN.",
                "questions": [
                    q(27, "The heat island effect is often strongest at night.", correct_options=["YES"]),
                    q(28, "The urban heat island is a seriously underestimated health risk.", correct_options=["YES"]),
                    q(29, "Air conditioning helps to cool city streets.", correct_options=["NO"]),
                    q(30, "Singapore was the first city to require green roofs.", correct_options=["NOT GIVEN"]),
                    q(31, "Fountains are the most effective way to cool a city.", correct_options=["NO"]),
                ],
            },
            {
                "type": "mcq",
                "instruction": "Questions 32–35\nChoose the correct letter, A, B or C.",
                "questions": [
                    q(
                        32,
                        "Building materials make cities hotter because they",
                        options=letters(
                            "reflect sunlight.", "absorb heat and release it slowly.", "produce heat themselves."
                        ),
                        correct_options=["B"],
                    ),
                    q(
                        33,
                        "Plants cool the air mainly through",
                        options=letters(
                            "the shade they give.", "water evaporating from their leaves.", "absorbing pollution."
                        ),
                        correct_options=["B"],
                    ),
                    q(
                        34,
                        "Painting roofs white",
                        options=letters("is very expensive.", "reflects sunlight.", "only works in hot countries."),
                        correct_options=["B"],
                    ),
                    q(
                        35,
                        "The writer thinks city planners should focus first on",
                        options=letters("fountains.", "white roofs.", "trees."),
                        correct_options=["C"],
                    ),
                ],
            },
            {
                "type": "short_answer",
                "instruction": "Questions 36–40\nAnswer the questions below.\nChoose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage for each answer.",
                "word_limit": 3,
                "allow_number": True,
                "questions": [
                    q(
                        36,
                        "How much warmer than rural areas can a city become?",
                        correct_texts=["seven degrees", "7 degrees"],
                    ),
                    q(
                        37,
                        "Which people are particularly at risk during heatwaves?",
                        correct_texts=["elderly people", "the elderly", "elderly"],
                    ),
                    q(38, "What does air conditioning use large amounts of?", correct_texts=["electricity"]),
                    q(
                        39,
                        "Apart from green roofs, what can new buildings in Singapore include?",
                        correct_texts=["walls", "green walls", "walls with plants"],
                    ),
                    q(40, "What can individuals put on a balcony to help?", correct_texts=["plants", "a few plants"]),
                ],
            },
        ],
    ),
]

# ───────────────────────── Writing ─────────────────────────

WRITING = [
    (
        1,
        "The graph below shows the number of visitors to three London museums between 2015 and 2020.\n\n"
        "Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    ),
    (
        2,
        "Some people believe that university education should be free for everyone. Others think that students should pay "
        "for their own studies.\n\nDiscuss both views and give your own opinion.\n\n"
        "Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    ),
]

# ───────────────────────── Speaking ─────────────────────────

SPEAKING = [
    (
        1,
        "Let's talk about where you live. Do you live in a house or an apartment?",
        None,
        "I live in a three-bedroom apartment on the fifth floor of a fairly new building. It's not huge, but it's bright and "
        "it has a small balcony where I like to drink tea in the evenings.",
    ),
    (
        1,
        "What do you like most about your neighbourhood?",
        None,
        "I'd say it's how convenient it is. There's a market, a park and a metro station all within a ten-minute walk, so I "
        "rarely need a car. The only downside is that it can get quite noisy at weekends.",
    ),
    (
        1,
        "Do you work or are you a student?",
        None,
        "I'm a student at the moment. I'm in my second year of an economics degree, and I'm particularly interested in "
        "international trade, which is one reason I'm preparing for IELTS.",
    ),
    (
        1,
        "How do you usually spend your weekends?",
        None,
        "It depends on how busy I am, but usually I catch up with friends on Saturday and keep Sunday for myself. I often go "
        "jogging in the morning and then spend the afternoon reading or watching a film.",
    ),
    (
        2,
        "Describe a place you visited that you would like to visit again.",
        ["where it is", "when you went there", "what you did there", "and explain why you would like to go back"],
        "I'd like to talk about Samarkand, an ancient city in Uzbekistan that I visited with my family two summers ago. "
        "We spent four days there, and the highlight was definitely the Registan square, with its three enormous madrasas "
        "covered in blue tiles. We went there both during the day and at night, when the buildings are lit up, and it looked "
        "completely different. We also explored the old bazaar, where I tried the famous Samarkand bread, and visited the "
        "observatory of Ulugh Beg, which taught me a lot about the history of astronomy. The reason I'd love to go back is "
        "that four days simply weren't enough. There were so many places we only saw from the outside, and I'd like to "
        "spend more time talking to local craftsmen, for example the people who still make paper by hand. I think next "
        "time I'd go in spring, when the weather is milder and the gardens are in bloom.",
    ),
    (
        3,
        "Why do you think people like to travel to historical places?",
        None,
        "I think there are a few reasons. First, it's a way of connecting with the past in a very direct way: reading about "
        "an event is one thing, but standing where it actually happened is far more powerful. Second, historical places are "
        "often beautiful, so people enjoy them even if they're not particularly interested in history.",
    ),
    (
        3,
        "Should governments spend money on protecting old buildings?",
        None,
        "On the whole, yes. Old buildings are part of a nation's identity, and once they are destroyed they can't be "
        "replaced. That said, I think the money should be spent wisely, perhaps by combining restoration with tourism so "
        "that the buildings help to pay for their own upkeep.",
    ),
    (
        3,
        "How might tourism change in the future?",
        None,
        "I imagine it will become more sustainable, partly because people are more aware of the environmental cost of "
        "flying. We may also see more virtual tourism, where people explore places through virtual reality before deciding "
        "whether a real trip is worth it.",
    ),
]


async def add_groups(session, section: Section, groups: list[dict], passage_id: int, start: int) -> int:
    for i, g in enumerate(groups):
        data = QuestionGroupCreate(**g, passage_id=passage_id, position=start + i)
        await validate_group(session, section, data)
        session.add(build_group(section, data))
        await session.flush()
    return start + len(groups)


def copy_media(source: Path, folder: str, name: str) -> str:
    target = Path(settings.MEDIA_ROOT) / folder / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    return f"/media/{folder}/{name}"


async def main():
    async with SessionLocal() as session:
        old = await session.scalar(select(IeltsTest).where(IeltsTest.title == TITLE))
        if old:
            if await has_attempts(session, old.id):
                sys.exit(f"«{TITLE}» уже проходили — оставляю как есть (id {old.id}).")
            await session.execute(delete(IeltsTest).where(IeltsTest.id == old.id))
            await session.commit()
            print(f"Старый «{TITLE}» удалён.")

        test = IeltsTest(
            title=TITLE,
            sections=[Section(type=t, duration_min=m, position=i) for i, (t, m) in enumerate(DEFAULT_SECTIONS)],
        )
        session.add(test)
        await session.flush()
        sections = {s.type: s for s in test.sections}

        # Listening: запись и транскрипт каждой части, к ней — группы вопросов
        listening = sections[SectionType.LISTENING]
        position = 0
        for n, (part, groups) in enumerate(zip(PARTS, LISTENING_GROUPS, strict=True), start=1):
            url = copy_media(DEMO / f"listening_part{n}.mp3", "audio", f"demo-listening-part{n}.mp3")
            passage = Passage(
                section_id=listening.id,
                title=part["title"],
                text=transcript(part),
                audio_url=url,
                audio_duration_sec=await audio_duration(url),
                position=n - 1,
            )
            session.add(passage)
            await session.flush()
            position = await add_groups(session, listening, groups, passage.id, position)

        reading = sections[SectionType.READING]
        position = 0
        for n, (title, text, groups) in enumerate(READING):
            passage = Passage(section_id=reading.id, title=title, text=text, position=n)
            session.add(passage)
            await session.flush()
            position = await add_groups(session, reading, groups, passage.id, position)

        chart = copy_media(DEMO / "museum_chart.svg", "images", "demo-museum-chart.svg")
        for number, prompt in WRITING:
            min_words, minutes = (150, 20) if number == 1 else (250, 40)
            session.add(
                WritingTask(
                    section_id=sections[SectionType.WRITING].id,
                    task_number=number,
                    prompt=prompt,
                    image_url=chart if number == 1 else None,
                    min_words=min_words,
                    recommended_min=minutes,
                )
            )

        counters = {1: 0, 2: 0, 3: 0}
        for part, prompt, points, answer in SPEAKING:
            session.add(
                SpeakingTask(
                    section_id=sections[SectionType.SPEAKING].id,
                    part=part,
                    position=counters[part],
                    prompt=prompt,
                    cue_card_points=points,
                    sample_answer=answer,
                )
            )
            counters[part] += 1

        await session.flush()
        problems = await test_problems(session, test)
        if problems:
            await session.rollback()
            sys.exit("Тест неполный, не сохранён:\n- " + "\n- ".join(problems))
        test.is_published = True
        await notifications.test_published(session, test)  # ученикам — «новый тест»
        await session.commit()
        print(f"Готово: «{TITLE}» (id {test.id}) опубликован — Listening, Reading, Writing и Speaking.")


if __name__ == "__main__":
    asyncio.run(main())
