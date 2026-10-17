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
