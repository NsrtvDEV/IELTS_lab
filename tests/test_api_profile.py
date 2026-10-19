"""Профиль: контакты, «о себе», аватар; профиль учителя — статистика и последние действия."""

import httpx

from app.main import app
from tests.test_api_writing import assessment, write_and_submit

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


async def test_profile_contacts_and_avatar(client, teacher):
    r = await client.patch("/users/me", headers=teacher, json={
        "first_name": "John", "last_name": "Smith", "phone": " +998 90 123 45 67 ",
        "location": "Tashkent, Uzbekistan", "bio": "IELTS trainer with 5+ years of experience.",
    })
    assert r.status_code == 200, r.text
    profile = r.json()["profile"]
    assert profile["phone"] == "+998 90 123 45 67"
    assert profile["location"] == "Tashkent, Uzbekistan"
    assert profile["bio"].startswith("IELTS trainer")
    assert (await client.patch("/users/me", headers=teacher, json={"phone": "call me"})).status_code == 422
    assert (await client.patch("/users/me", headers=teacher, json={"bio": "x" * 501})).status_code == 422

    files = {"file": ("me.svg", b"<svg/>", "image/svg+xml")}
    assert (await client.post("/users/me/avatar", headers=teacher, files=files)).status_code == 415
    r = await client.post("/users/me/avatar", headers=teacher, files={"file": ("me.png", PNG, "image/png")})
    assert r.status_code == 200, r.text
    first = r.json()["profile"]["avatar_url"]
    assert first.startswith("/media/avatars/")

    # новый аватар заменяет старый, удаление очищает
    r = await client.post("/users/me/avatar", headers=teacher, files={"file": ("me.png", PNG, "image/png")})
    assert r.json()["profile"]["avatar_url"] != first
    r = await client.delete("/users/me/avatar", headers=teacher)
    assert r.json()["profile"]["avatar_url"] is None


async def test_teacher_profile_stats(client, teacher, student, make_user, published_test):
    assert (await client.get("/teacher/profile", headers=student)).status_code == 403
    mine = (await client.post("/teacher/tests", headers=teacher, json={"title": "My draft"})).json()
    other = await make_user("other@example.com", role="teacher")
    await client.post("/teacher/tests", headers=other, json={"title": "Not mine"})

    content = await write_and_submit(client, student, published_test["id"])
    stats = (await client.get("/teacher/profile", headers=teacher)).json()
    assert stats["students"] == 1
    assert stats["tests_created"] == 2  # published_test тоже создал этот учитель
    assert stats["works_assessed"] == 0 and stats["waiting_review"] == 1
    assert [a["kind"] for a in stats["activity"]] == ["test_created", "test_created"]
    assert stats["activity"][0]["title"] == "My draft" and stats["activity"][0]["test_id"] == mine["id"]

    sa = content["section_attempt_id"]
    r = await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=assessment(content))
    assert r.status_code == 200, r.text
    stats = (await client.get("/teacher/profile", headers=teacher)).json()
    assert stats["works_assessed"] == 1 and stats["waiting_review"] == 0
    latest = stats["activity"][0]
    assert latest["kind"] == "work_assessed" and latest["section"] == "writing"
    assert latest["band"] == "7.0" and latest["section_attempt_id"] == sa and latest["student"]
    # чужие оценки в профиль не попадают
    assert (await client.get("/teacher/profile", headers=other)).json()["works_assessed"] == 0


async def test_avatar_is_served(client, student):
    r = await client.post("/users/me/avatar", headers=student, files={"file": ("me.png", PNG, "image/png")})
    url = r.json()["profile"]["avatar_url"]
    # фото отдаётся как статический файл (без /api/v1)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as raw:
        assert (await raw.get(url)).status_code == 200
