"""Тексты лендинга: публичное чтение, правка только администратором, проверка полей, сброс."""

import pytest


@pytest.fixture
async def admin(make_user):
    return await make_user("admin@example.com", role="admin", first_name="Ada", last_name="Admin")


async def test_landing_defaults_and_edit(client, admin, teacher):
    r = await client.get("/site/landing")
    assert r.status_code == 200
    assert r.json()["settings"]["show_stats"] is True and r.json()["en"] == {"features": [], "skills": []}

    content = {
        "settings": {
            "show_stats": False,
            "show_skills": False,
            "telegram_url": "@bandup_uz",
            "hero_image_url": "/media/images/a.png",
        },
        "en": {
            "hero_title": "  Learn faster. ",
            "hero_badge": "",
            "features": [{"title": "Real tests"}, {}],
            "about_points": ["One", "Two"],
        },
        "ru": {"hero_title": "Учитесь быстрее."},
    }
    assert (await client.put("/admin/landing", headers=teacher, json=content)).status_code == 403
    r = await client.put("/admin/landing", headers=admin, json=content)
    assert r.status_code == 200, r.text

    public = (await client.get("/site/landing")).json()  # без входа
    assert public["settings"]["show_stats"] is False and public["settings"]["show_skills"] is False
    assert public["settings"]["telegram_url"] == "https://t.me/bandup_uz"
    assert public["en"]["hero_title"] == "Learn faster."  # пробелы обрезаны
    assert "hero_badge" not in public["en"]  # пустое — стандартный текст
    assert public["en"]["features"] == [{"title": "Real tests"}, {}]
    assert public["en"]["about_points"] == ["One", "Two"]
    assert public["ru"]["hero_title"] == "Учитесь быстрее."

    assert (await client.delete("/admin/landing", headers=admin)).status_code == 204
    assert (await client.get("/site/landing")).json()["settings"]["show_stats"] is True


@pytest.mark.parametrize(
    "content",
    [
        {"settings": {"telegram_url": "https://evil.example/x"}},
        {"settings": {"hero_image_url": "javascript:alert(1)"}},
        {"settings": {"hero_image_url": "/etc/passwd"}},
        {"en": {"hero_title": "x" * 81}},
        {"en": {"features": [{}, {}, {}, {}, {}]}},
        {"en": {"about_points": ["p"] * 7}},
    ],
)
async def test_landing_validation(client, admin, content):
    assert (await client.put("/admin/landing", headers=admin, json=content)).status_code == 422
