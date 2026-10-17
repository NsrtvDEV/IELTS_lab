"""Общие фикстуры.

Модульные тесты (test_scoring.py) работают без БД.
Интеграционные (test_api_*.py) — на отдельной PostgreSQL-базе:

    TEST_DB_NAME=ielts_lab_test uv run pytest

Пользователь, пароль, хост и порт берутся из .env; база создаётся сама.
Без TEST_DB_NAME интеграционные тесты пропускаются.
"""

import os

TEST_DB_NAME = os.environ.get("TEST_DB_NAME")
if TEST_DB_NAME:
    # защита от запуска на рабочей базе: тесты очищают таблицы
    if not TEST_DB_NAME.endswith("_test"):
        raise RuntimeError("TEST_DB_NAME must end with '_test'")
    os.environ["DB_NAME"] = TEST_DB_NAME  # до импорта app.config

import httpx  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import DB_URL, Base  # noqa: E402
from app.limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402

PASSWORD = "secret123"


def pytest_collection_modifyitems(config, items):
    if TEST_DB_NAME:
        return
    skip = pytest.mark.skip(reason="set TEST_DB_NAME=<name>_test to run API tests")
    for item in items:
        if item.path.name.startswith("test_api_"):
            item.add_marker(skip)


@pytest.fixture(scope="session")
def database():
    """Создаёт тестовую базу (если нет) и применяет миграции."""
    from alembic import command
    from alembic.config import Config

    admin = create_engine(DB_URL.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": settings.DB_NAME}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{settings.DB_NAME}"'))
    admin.dispose()

    command.upgrade(Config("alembic.ini"), "head")
    engine = create_engine(DB_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def sql(database):
    """Выполнить SQL в тестовой базе (подготовка данных, проверки)."""

    def run(query: str, **params):
        with database.begin() as conn:
            return conn.execute(text(query), params)

    return run


@pytest.fixture(autouse=True)
def clean_db(request):
    """Перед каждым API-тестом — пустые таблицы (шкала баллов из миграции остаётся)."""
    if not request.node.path.name.startswith("test_api_"):
        yield
        return
    engine = request.getfixturevalue("database")
    tables = [t for t in Base.metadata.tables if t != "band_conversion"]
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture(scope="session", autouse=True)
def no_rate_limit():
    limiter.enabled = False
    yield
    limiter.enabled = True


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as c:
        yield c


@pytest.fixture
def make_user(client, sql):
    """Зарегистрировать пользователя и вернуть заголовки авторизации."""

    async def create(email: str, role: str = "student", first_name: str = "Test", last_name: str = "User"):
        r = await client.post(
            "/auth/register",
            json={"email": email, "password": PASSWORD, "first_name": first_name, "last_name": last_name},
        )
        assert r.status_code == 201, r.text
        if role != "student":
            sql("UPDATE users SET role = CAST(:r AS user_role) WHERE email = :e", r=role, e=email)
        r = await client.post("/auth/login", json={"email": email, "password": PASSWORD})
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return create


@pytest.fixture
async def teacher(make_user):
    return await make_user("teacher@example.com", role="teacher", first_name="Tina", last_name="Teacher")


@pytest.fixture
async def student(make_user):
    return await make_user("student@example.com", first_name="Aziza", last_name="Karimova")


# ───────────────────────── Опубликованный тест ─────────────────────────

READING_GROUPS = [
    # Q1–2 TFNG: TRUE, FALSE
    {"type": "tfng", "instruction": "Questions 1–2. TRUE / FALSE / NOT GIVEN",
     "questions": [{"number": 1, "text": "s1", "correct_options": ["TRUE"]},
                   {"number": 2, "text": "s2", "correct_options": ["FALSE"]}]},
    # Q3 MCQ: B
    {"type": "mcq", "instruction": "Question 3",
     "questions": [{"number": 3, "text": "When?", "options": [{"label": L, "text": L} for L in "ABCD"],
                    "correct_options": ["B"]}]},
    # Q4 matching headings: ii
    {"type": "matching_headings", "instruction": "Question 4",
     "options": [{"label": "i", "text": "Intro"}, {"label": "ii", "text": "Rome"}, {"label": "iii", "text": "Now"}],
     "questions": [{"number": 4, "text": "Paragraph B", "correct_options": ["ii"]}]},
    # Q5 completion, лимит 2 слова
    {"type": "sentence_completion", "instruction": "Question 5", "word_limit": 2,
     "questions": [{"number": 5, "text": "Made in ____", "correct_texts": ["Mesopotamia"]}]},
    # Q6 Choose TWO: A, C (2 балла)
    {"type": "mcq_multi", "instruction": "Question 6",
     "questions": [{"number": 6, "text": "Which TWO?", "answers_required": 2,
                    "options": [{"label": L, "text": L} for L in "ABCD"], "correct_options": ["A", "C"]}]},
    # Q7–40 gap fill
    {"type": "gap_fill", "instruction": "Questions 7–40", "word_limit": 1,
     "questions": [{"number": n, "text": f"gap {n}", "correct_texts": [f"x{n}"]} for n in range(7, 41)]},
]


async def build_test(client, teacher, sql, publish=True):
    """Тест с полным Reading (40 вопросов разных типов), Listening, Writing и Speaking."""
    test = (await client.post("/teacher/tests", headers=teacher, json={"title": "Mock 1"})).json()
    sec = {s["type"]: s["id"] for s in test["sections"]}
    passage = (await client.post(f"/teacher/sections/{sec['reading']}/passages", headers=teacher,
                                 json={"title": "Glass", "text": "Glass was first made in Mesopotamia."})).json()
    for i, g in enumerate(READING_GROUPS):
        r = await client.post(f"/teacher/sections/{sec['reading']}/question-groups", headers=teacher,
                              json={**g, "passage_id": passage["id"], "position": i})
        assert r.status_code == 201, r.text
    part = (await client.post(f"/teacher/sections/{sec['listening']}/passages", headers=teacher,
                              json={"audio_url": "https://cdn.example.com/p1.mp3"})).json()
    r = await client.post(f"/teacher/sections/{sec['listening']}/question-groups", headers=teacher, json={
        "passage_id": part["id"], "type": "gap_fill", "instruction": "Questions 1–40",
        "questions": [{"number": n, "correct_texts": ["a"]} for n in range(1, 41)]})
    assert r.status_code == 201, r.text
    sql(
        "INSERT INTO writing_tasks (section_id, task_number, prompt, min_words, recommended_min) "
        "VALUES (:s, 1, 'Describe', 150, 20), (:s, 2, 'Discuss', 250, 40)",
        s=sec["writing"],
    )
    sql("INSERT INTO speaking_tasks (section_id, part, prompt) VALUES (:s, 1, 'p1'), (:s, 2, 'p2'), (:s, 3, 'p3')",
        s=sec["speaking"])
    if publish:
        r = await client.post(f"/teacher/tests/{test['id']}/publish", headers=teacher)
        assert r.status_code == 200, r.text
    return {"id": test["id"], "sections": sec, "passage_id": passage["id"]}


@pytest.fixture
async def published_test(client, teacher, sql):
    return await build_test(client, teacher, sql)
