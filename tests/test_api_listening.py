"""Listening: загрузка записей, прохождение, транскрипт только после сдачи, полный экзамен."""

from app.config import settings
from tests.conftest import build_test

MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x0f" + b"\xff\xfb\x90\x00" * 64  # заглушка mp3


async def start_listening(client, headers, test_id):
    attempt = (await client.post("/attempts", headers=headers, json={"test_id": test_id, "section_type": "listening"})).json()
    r = await client.post(f"/listening/attempts/{attempt['id']}/start", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def test_audio_upload(client, teacher, student, monkeypatch):
    r = await client.post("/teacher/uploads/audio", headers=teacher, files={"file": ("part1.mp3", MP3, "audio/mpeg")})
    assert r.status_code == 201
    url = r.json()["url"]
    assert url.startswith("/media/audio/") and url.endswith(".mp3")
    served = await client.get(f"http://test{url}")
    assert served.status_code == 200 and served.content == MP3

    r = await client.post("/teacher/uploads/audio", headers=teacher, files={"file": ("x.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 415
    r = await client.post("/teacher/uploads/audio", headers=teacher, files={"file": ("e.mp3", b"", "audio/mpeg")})
    assert r.status_code == 400
    r = await client.post("/teacher/uploads/audio", headers=student, files={"file": ("p.mp3", MP3, "audio/mpeg")})
    assert r.status_code == 403

    monkeypatch.setattr(settings, "MAX_LISTENING_AUDIO_MB", 0)
    r = await client.post("/teacher/uploads/audio", headers=teacher, files={"file": ("big.mp3", MP3, "audio/mpeg")})
    assert r.status_code == 413


async def test_listening_flow_and_transcript_after_submit(client, student, published_test, sql):
    listening = published_test["sections"]["listening"]
    sql("UPDATE passages SET text = 'Woman: The answer is a.' WHERE section_id = :s", s=listening)

    content = await start_listening(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    part = content["passages"][0]
    assert part["audio_url"] == "https://cdn.example.com/p1.mp3"
    assert part["text"] is None  # транскрипт во время теста не отдаётся

    questions = sorted((q for g in content["question_groups"] for q in g["questions"]), key=lambda q: q["number"])
    answers = [{"question_id": q["id"], "answer_text": "A"} for q in questions[:3]]
    assert (await client.put(f"/listening/{sa}/answers", headers=student, json={"answers": answers})).status_code == 204

    # Reading-эндпоинты с секцией Listening не работают
    assert (await client.get(f"/reading/{sa}", headers=student)).status_code == 404

    r = await client.post(f"/listening/{sa}/submit", headers=student)
    assert r.json()["raw_score"] == 3
    assert r.json()["band_score"] == "2.0"  # шкала Listening: raw 2–3 -> 2.0

    result = (await client.get(f"/listening/{sa}/result", headers=student)).json()
    assert result["correct_count"] == 3 and result["section_type"] == "listening"
    assert result["passages"][0]["text"] == "Woman: The answer is a."  # после сдачи — можно


async def test_publish_requires_audio_for_every_part(client, teacher, sql):
    test = await build_test(client, teacher, sql, publish=False)
    sql("UPDATE passages SET audio_url = NULL WHERE section_id = :s", s=test["sections"]["listening"])
    problems = (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"]
    assert "listening: no audio for part(s) [1]" in problems
    assert (await client.post(f"/teacher/tests/{test['id']}/publish", headers=teacher)).status_code == 409


async def test_full_exam_goes_listening_then_reading(client, student, published_test):
    attempt = (await client.post("/attempts", headers=student, json={"test_id": published_test["id"]})).json()
    r = await client.post(f"/listening/attempts/{attempt['id']}/start", headers=student)
    sa = r.json()["section_attempt_id"]
    await client.post(f"/listening/{sa}/submit", headers=student)

    state = (await client.get(f"/attempts/{attempt['id']}", headers=student)).json()
    assert state["next_section"] == "reading"
    r = await client.post(f"/reading/attempts/{attempt['id']}/start", headers=student)
    assert r.status_code == 200


# ───────────────────────── Доработки: длина записей, место воспроизведения, файлы ─────────────────────────

import math  # noqa: E402
import struct  # noqa: E402
import wave  # noqa: E402
from io import BytesIO  # noqa: E402
from pathlib import Path  # noqa: E402


def wav(seconds: float) -> bytes:
    buf = BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"".join(struct.pack("<h", int(3000 * math.sin(i / 3))) for i in range(int(8000 * seconds))))
    return buf.getvalue()


async def upload(client, teacher, seconds):
    r = await client.post("/teacher/uploads/audio", headers=teacher, files={"file": ("p.wav", wav(seconds), "audio/wav")})
    assert r.status_code == 201, r.text
    return r.json()


def file_of(url):
    return Path(settings.MEDIA_ROOT) / url.removeprefix("/media/")


async def test_upload_reports_duration_and_passage_stores_it(client, teacher):
    up = await upload(client, teacher, 3)
    assert up["duration_sec"] == 3
    test = (await client.post("/teacher/tests", headers=teacher, json={"title": "T"})).json()
    sec = next(s["id"] for s in test["sections"] if s["type"] == "listening")
    p = (await client.post(f"/teacher/sections/{sec}/passages", headers=teacher, json={"audio_url": up["url"]})).json()
    assert p["audio_duration_sec"] == 3
    ext = (await client.post(f"/teacher/sections/{sec}/passages", headers=teacher,
                             json={"audio_url": "https://cdn.example.com/x.mp3"})).json()
    assert ext["audio_duration_sec"] is None  # длина внешней ссылки неизвестна


async def test_section_time_must_fit_recordings(client, teacher, sql):
    test = await build_test(client, teacher, sql, publish=False)
    listening = test["sections"]["listening"]
    up = await upload(client, teacher, 2)
    passage = sql("SELECT id FROM passages WHERE section_id = :s", s=listening).scalar()
    await client.patch(f"/teacher/passages/{passage}", headers=teacher, json={"audio_url": up["url"]})
    # 1 минута < 2 с записи + 2 минуты на проверку
    await client.patch(f"/teacher/sections/{listening}", headers=teacher, json={"duration_min": 1})
    problems = (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"]
    assert "listening: recordings last 0:02 — set the section time to at least 3 min" in problems[0]
    await client.patch(f"/teacher/sections/{listening}", headers=teacher, json={"duration_min": 3})
    assert (await client.post(f"/teacher/tests/{test['id']}/publish", headers=teacher)).status_code == 200


async def test_playback_only_moves_forward(client, student, published_test):
    content = await start_listening(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    assert content["playback"] is None
    url = f"/listening/{sa}/playback"

    assert (await client.put(url, headers=student, json={"part": 0, "position": 42.5})).json()["position"] == 42.5
    # назад нельзя — сервер возвращает сохранённое место
    back = (await client.put(url, headers=student, json={"part": 0, "position": 1})).json()
    assert back == {"part": 0, "position": 42.5, "finished": False}
    assert (await client.put(url, headers=student, json={"part": 5, "position": 0})).status_code == 400

    await client.put(url, headers=student, json={"part": 0, "position": 60, "finished": True})
    again = (await client.put(url, headers=student, json={"part": 0, "position": 0})).json()
    assert again["finished"] is True  # дослушанную запись не "перезапустить"

    reloaded = (await client.get(f"/listening/{sa}", headers=student)).json()
    assert reloaded["playback"]["finished"] is True
    assert (await client.put(f"/reading/{sa}/playback", headers=student, json={"part": 0, "position": 0})).status_code in (404, 405)


async def test_replaced_and_deleted_files_are_removed(client, teacher):
    test = (await client.post("/teacher/tests", headers=teacher, json={"title": "T"})).json()
    sec = next(s["id"] for s in test["sections"] if s["type"] == "listening")
    first, second = await upload(client, teacher, 1), await upload(client, teacher, 1)
    p = (await client.post(f"/teacher/sections/{sec}/passages", headers=teacher, json={"audio_url": first["url"]})).json()
    assert file_of(first["url"]).exists()

    await client.patch(f"/teacher/passages/{p['id']}", headers=teacher, json={"audio_url": second["url"]})
    assert not file_of(first["url"]).exists()  # заменённая запись удалена
    assert file_of(second["url"]).exists()

    await client.delete(f"/teacher/tests/{test['id']}", headers=teacher)
    assert not file_of(second["url"]).exists()  # вместе с тестом


async def test_layout_template_validation(client, teacher):
    test = (await client.post("/teacher/tests", headers=teacher, json={"title": "T"})).json()
    sec = next(s["id"] for s in test["sections"] if s["type"] == "listening")
    group = {"type": "form_completion", "instruction": "Questions 1–2", "word_limit": 2,
             "questions": [{"number": 1, "correct_texts": ["Smith"]}, {"number": 2, "correct_texts": ["14"]}]}
    url = f"/teacher/sections/{sec}/question-groups"

    r = await client.post(url, headers=teacher, json={**group, "meta": {"template": "Name: {1}\nAge: {3}"}})
    assert r.status_code == 400 and "[3]" in r.json()["detail"]
    r = await client.post(url, headers=teacher, json={**group, "meta": {"template": "{1} {1} {2}"}})
    assert r.status_code == 400 and "once" in r.json()["detail"]
    r = await client.post(url, headers=teacher, json={**group, "meta": {"template": "Name: Mr {1}\nAge | {2}"}})
    assert r.status_code == 201 and r.json()["meta"]["template"] == "Name: Mr {1}\nAge | {2}"
