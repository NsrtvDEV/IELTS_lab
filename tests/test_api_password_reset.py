"""Сброс пароля по email: письмо со ссылкой, одноразовость, срок действия, выход со всех устройств."""

import re

import pytest

from app.routers.auth import password_reset
from tests.conftest import PASSWORD


@pytest.fixture
def outbox(monkeypatch):
    sent = []

    async def fake_send(to, subject, text, html):
        sent.append({"to": to, "subject": subject, "text": text, "html": html})

    monkeypatch.setattr(password_reset, "send_email", fake_send)
    return sent


def token_from(mail) -> str:
    return re.search(r"reset-password\?token=([\w-]+)", mail["text"]).group(1)


async def login(client, password):
    return await client.post("/auth/login", json={"email": "student@example.com", "password": password})


async def test_reset_password_by_email(client, student, outbox):
    other_device = (await login(client, PASSWORD)).json()["refresh_token"]

    # неизвестный адрес — тот же ответ, письма нет
    r = await client.post("/auth/password-reset/request", json={"email": "nobody@example.com"})
    assert r.status_code == 202 and outbox == []

    r = await client.post("/auth/password-reset/request", json={"email": "Student@Example.com", "lang": "ru"})
    assert r.status_code == 202
    assert len(outbox) == 1 and outbox[0]["to"] == "student@example.com"
    assert outbox[0]["subject"] == "Сброс пароля BandUp" and "Здравствуйте, Aziza!" in outbox[0]["text"]
    token = token_from(outbox[0])

    # повторный запрос в ту же минуту — новое письмо не уходит
    await client.post("/auth/password-reset/request", json={"email": "student@example.com"})
    assert len(outbox) == 1

    assert (await client.get("/auth/password-reset/check", params={"token": token})).status_code == 200
    r = await client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "short"})
    assert r.status_code == 422
    r = await client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "brandnew123"})
    assert r.status_code == 200

    assert (await login(client, PASSWORD)).status_code == 401
    assert (await login(client, "brandnew123")).status_code == 200
    # старые сессии закрыты, ссылка одноразовая
    assert (await client.post("/auth/refresh", json={"refresh_token": other_device})).status_code == 401
    r = await client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "another123"})
    assert r.status_code == 400 and "expired" in r.json()["detail"]
    assert (await client.get("/auth/password-reset/check", params={"token": token})).status_code == 400


async def test_expired_and_unknown_links(client, student, outbox, sql):
    await client.post("/auth/password-reset/request", json={"email": "student@example.com"})
    token = token_from(outbox[0])
    sql("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute'")
    r = await client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "brandnew123"})
    assert r.status_code == 400
    r = await client.post("/auth/password-reset/confirm", json={"token": "x" * 40, "new_password": "brandnew123"})
    assert r.status_code == 400
    assert (await login(client, PASSWORD)).status_code == 200


async def test_blocked_user_gets_no_email(client, student, outbox, sql):
    sql("UPDATE users SET is_active = false WHERE email = 'student@example.com'")
    r = await client.post("/auth/password-reset/request", json={"email": "student@example.com"})
    assert r.status_code == 202 and outbox == []


async def test_newer_link_works_and_old_links_die(client, student, outbox, sql):
    await client.post("/auth/password-reset/request", json={"email": "student@example.com"})
    first = token_from(outbox[0])
    sql("UPDATE password_reset_tokens SET created_at = now() - interval '2 minutes'")  # минута прошла
    await client.post("/auth/password-reset/request", json={"email": "student@example.com"})
    second = token_from(outbox[1])
    assert first != second
    r = await client.post("/auth/password-reset/confirm", json={"token": second, "new_password": "brandnew123"})
    assert r.status_code == 200
    r = await client.post("/auth/password-reset/confirm", json={"token": first, "new_password": "another123"})
    assert r.status_code == 400
