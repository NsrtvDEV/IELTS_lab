"""Администратор: обзор платформы, рост пользователей, управление ролями и блокировкой."""

from datetime import date

import pytest

from tests.conftest import PASSWORD
from tests.test_api_writing import assessment, write_and_submit


@pytest.fixture
async def admin(make_user):
    return await make_user("admin@example.com", role="admin", first_name="Ada", last_name="Admin")


async def test_only_admins(client, teacher, student, admin):
    for headers in (teacher, student):
        assert (await client.get("/admin/dashboard", headers=headers)).status_code == 403
        assert (await client.get("/admin/users", headers=headers)).status_code == 403
    assert (await client.get("/admin/dashboard", headers=admin)).status_code == 200


async def test_dashboard_numbers(client, admin, teacher, student, published_test):
    content = await write_and_submit(client, student, published_test["id"])
    await client.post(
        f"/teacher/review/writing/{content['section_attempt_id']}", headers=teacher, json=assessment(content)
    )

    d = (await client.get("/admin/dashboard", headers=admin)).json()
    assert d["total_users"]["value"] == 3 and d["total_teachers"]["value"] == 1
    assert d["total_tests"]["value"] == 1
    assert d["average_band"]["value"] == "7.0"
    assert {r["role"]: r["count"] for r in d["roles"]} == {"student": 1, "teacher": 1, "admin": 1}
    assert d["blocked_users"] == 0
    assert d["top_tests"] == [{"id": published_test["id"], "title": "Mock 1", "average_band": "7.0", "attempts": 1}]
    assert d["skills"] == [{"section": "writing", "attempts": 1}]
    joined = [u["joined_at"] for u in d["recent_users"]]
    assert len(joined) == 3 and joined == sorted(joined, reverse=True)  # новые сверху
    kinds = {a["kind"] for a in d["activity"]}
    assert {"user_joined", "section_completed", "test_created"} <= kinds
    done = next(a for a in d["activity"] if a["kind"] == "section_completed")
    assert done["section"] == "writing" and done["band"] == "7.0" and done["test_title"] == "Mock 1"


async def test_growth(client, admin, student, sql):
    sql("UPDATE users SET created_at = now() - interval '10 days' WHERE email = 'student@example.com'")
    points = (await client.get("/admin/growth", headers=admin, params={"days": 30})).json()
    assert len(points) == 30 and points[-1]["date"] == date.today().isoformat()
    assert points[0]["users"] == 0 and points[-1]["users"] == 2
    assert [p["users"] for p in points] == sorted(p["users"] for p in points)  # только растёт
    assert (await client.get("/admin/growth", headers=admin, params={"days": 12})).status_code == 422


async def test_manage_users(client, admin, teacher, student):
    users = (await client.get("/admin/users", headers=admin)).json()
    assert {u["email"] for u in users} == {"admin@example.com", "teacher@example.com", "student@example.com"}
    assert [
        u["email"] for u in (await client.get("/admin/users", headers=admin, params={"role": "teacher"})).json()
    ] == ["teacher@example.com"]
    assert [u["email"] for u in (await client.get("/admin/users", headers=admin, params={"q": "aziz"})).json()] == [
        "student@example.com"
    ]

    me = next(u for u in users if u["email"] == "admin@example.com")
    assert (await client.patch(f"/admin/users/{me['id']}", headers=admin, json={"role": "student"})).status_code == 400

    s = next(u for u in users if u["email"] == "student@example.com")
    r = await client.patch(f"/admin/users/{s['id']}", headers=admin, json={"role": "teacher"})
    assert r.status_code == 200 and r.json()["role"] == "teacher"
    assert (await client.get("/teacher/students", headers=student)).status_code == 200  # стал учителем

    refresh = (await client.post("/auth/login", json={"email": "student@example.com", "password": PASSWORD})).json()[
        "refresh_token"
    ]
    r = await client.patch(f"/admin/users/{s['id']}", headers=admin, json={"is_active": False})
    assert r.json()["is_active"] is False
    # заблокированный: старый токен не работает, войти и обновить сессию нельзя
    assert (await client.get("/users/me", headers=student)).status_code == 401
    assert (await client.post("/auth/refresh", json={"refresh_token": refresh})).status_code == 401
    assert (
        await client.post("/auth/login", json={"email": "student@example.com", "password": PASSWORD})
    ).status_code == 403
    assert [u["email"] for u in (await client.get("/admin/users", headers=admin, params={"blocked": True})).json()] == [
        "student@example.com"
    ]

    await client.patch(f"/admin/users/{s['id']}", headers=admin, json={"is_active": True})
    assert (
        await client.post("/auth/login", json={"email": "student@example.com", "password": PASSWORD})
    ).status_code == 200
    assert (await client.patch("/admin/users/999999", headers=admin, json={"is_active": False})).status_code == 404
