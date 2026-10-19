"""Speaking: вопросы учителя, записи ответов ученика, очередь проверки и оценка по критериям."""

from tests.conftest import build_test

AUDIO = b"\x1aE\xdf\xa3" + b"\x00" * 2048  # содержимое неважно: длину шлёт клиент
SCORES = {"fluency_coherence": 6, "lexical_resource": 7, "grammatical_range": 6, "pronunciation": 6}  # 6.25 -> 6.5


def recording(content=AUDIO, content_type="audio/webm;codecs=opus"):
    return {"file": ("answer.webm", content, content_type)}


async def start_speaking(client, headers, test_id, attempt_id=None):
    if attempt_id is None:
        attempt_id = (
            await client.post("/attempts", headers=headers, json={"test_id": test_id, "section_type": "speaking"})
        ).json()["id"]
    r = await client.post(f"/speaking/attempts/{attempt_id}/start", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def answer(client, headers, sa, task_id, duration=25):
    return await client.post(
        f"/speaking/{sa}/tasks/{task_id}", headers=headers, files=recording(), data={"duration_sec": duration}
    )


async def test_teacher_speaking_questions(client, teacher, student):
    test = (await client.post("/teacher/tests", headers=teacher, json={"title": "T"})).json()
    sec = {s["type"]: s["id"] for s in test["sections"]}
    url = f"/teacher/sections/{sec['speaking']}/speaking-tasks"

    q1 = (
        await client.post(
            url,
            headers=teacher,
            json={"part": 1, "prompt": " Do you work or study? ", "sample_answer": " I'm a student at a university. "},
        )
    ).json()
    assert (q1["prompt"], q1["position"], q1["prep_time_sec"], q1["speak_time_sec"]) == (
        "Do you work or study?",
        0,
        0,
        30,
    )
    assert q1["sample_answer"] == "I'm a student at a university."
    q2 = (await client.post(url, headers=teacher, json={"part": 1, "prompt": "Where do you live?"})).json()
    assert q2["position"] == 1  # в конец части
    card = (
        await client.post(
            url,
            headers=teacher,
            json={
                "part": 2,
                "prompt": "Describe a book you enjoyed.",
                "cue_card_points": ["what it was", "why you liked it"],
                "sample_answer": "I'd like to talk about...",
            },
        )
    ).json()
    assert (card["prep_time_sec"], card["speak_time_sec"], card["cue_card_points"]) == (
        60,
        120,
        ["what it was", "why you liked it"],
    )

    r = await client.post(url, headers=teacher, json={"part": 2, "prompt": "Another card"})
    assert r.status_code == 400  # карточка одна
    r = await client.post(url, headers=teacher, json={"part": 1, "prompt": "x", "cue_card_points": ["a"]})
    assert r.status_code == 400
    assert (await client.post(url, headers=teacher, json={"part": 4, "prompt": "x"})).status_code == 422
    assert (
        await client.post(
            f"/teacher/sections/{sec['writing']}/speaking-tasks", headers=teacher, json={"part": 1, "prompt": "x"}
        )
    ).status_code == 400
    assert (await client.post(url, headers=student, json={"part": 1, "prompt": "x"})).status_code == 403

    problems = (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"]
    assert "speaking: Part 1, 2 and 3 are required" in problems
    await client.post(
        url,
        headers=teacher,
        json={
            "part": 3,
            "prompt": "Why do people read less today?",
            "speak_time_sec": 90,
            "sample_answer": "Mostly because...",
        },
    )

    # у Where do you live? нет примерного ответа — публиковать нельзя
    problems = (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"]
    assert "speaking: add a sample answer to 1 question(s) — Part 1: Where do you live?" in problems
    r = await client.patch(
        f"/teacher/speaking-tasks/{q2['id']}",
        headers=teacher,
        json={"prompt": "Describe your hometown.", "position": 0, "sample_answer": "My hometown is Samarkand."},
    )
    assert r.json()["prompt"] == "Describe your hometown." and r.json()["sample_answer"] == "My hometown is Samarkand."
    content = (await client.get(f"/teacher/sections/{sec['speaking']}", headers=teacher)).json()
    assert [(t["part"], t["prompt"][:8]) for t in content["speaking_tasks"]] == [
        (1, "Do you w"),
        (1, "Describe"),
        (2, "Describe"),
        (3, "Why do p"),
    ]
    problems = (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"]
    assert not any(p.startswith("speaking") for p in problems)

    # ответы не помещаются во время секции
    await client.patch(f"/teacher/sections/{sec['speaking']}", headers=teacher, json={"duration_min": 3})
    problems = (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"]
    assert any(p.startswith("speaking: questions and answers take up to 6:10") for p in problems)

    assert (await client.delete(f"/teacher/speaking-tasks/{card['id']}", headers=teacher)).status_code == 204
    content = (await client.get(f"/teacher/sections/{sec['speaking']}", headers=teacher)).json()
    assert [t["part"] for t in content["speaking_tasks"]] == [1, 1, 3]


async def test_student_records_and_teacher_assesses(client, student, teacher, make_user, published_test):
    content = await start_speaking(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    assert [t["part"] for t in content["tasks"]] == [1, 2, 3]
    assert content["tasks"][1]["prep_time_sec"] == 60 and content["answered_task_ids"] == []
    assert "sample_answer" not in content["tasks"][0]  # примерный ответ — только после сдачи
    t1, t2, t3 = (t["id"] for t in content["tasks"])

    r = await answer(client, student, sa, t1)
    assert r.status_code == 201 and r.json()["duration_sec"] == 25
    assert (await answer(client, student, sa, t1)).status_code == 409  # перезаписать нельзя
    assert (await answer(client, student, sa, 999999)).status_code == 404
    r = await client.post(f"/speaking/{sa}/tasks/{t2}", headers=student, files=recording(content_type="text/plain"))
    assert r.status_code == 415
    r = await client.post(f"/speaking/{sa}/tasks/{t2}", headers=student, files=recording(content=b""))
    assert r.status_code == 400
    await answer(client, student, sa, t2, duration=118)

    resumed = (await client.get(f"/speaking/{sa}", headers=student)).json()
    assert resumed["answered_task_ids"] == [t1, t2]

    # Part 3 без ответа — работа всё равно уходит на проверку
    await client.post(f"/speaking/{sa}/submit", headers=student)
    attempt = (await client.get(f"/attempts/{content['attempt_id']}", headers=student)).json()
    assert attempt["status"] == "pending_review"
    result = (await client.get(f"/speaking/{sa}/result", headers=student)).json()
    assert result["status"] == "pending" and result["assessment"] is None
    assert [t["duration_sec"] for t in result["tasks"]] == [25, 118, None]
    assert [t["sample_answer"] for t in result["tasks"]] == ["a1", "a2", "a3"]
    response_id = result["tasks"][0]["response_id"]

    # запись слушают ученик и преподаватель, но не другие ученики
    r = await client.get(f"/speaking/recordings/{response_id}", headers=student)
    assert r.status_code == 200 and r.content == AUDIO and r.headers["content-type"].startswith("audio/webm")
    assert (await client.get(f"/speaking/recordings/{response_id}", headers=teacher)).status_code == 200
    other = await make_user("other@example.com")
    assert (await client.get(f"/speaking/recordings/{response_id}", headers=other)).status_code == 404
    assert (await client.get(f"/speaking/{sa}/result", headers=other)).status_code == 404

    queue = (await client.get("/teacher/review", headers=teacher)).json()
    assert len(queue) == 1
    assert (queue[0]["section_type"], queue[0]["answered"], queue[0]["questions"]) == ("speaking", 2, 3)
    assert (await client.get("/teacher/review", headers=teacher, params={"section": "writing"})).json() == []

    detail = (await client.get(f"/teacher/review/speaking/{sa}", headers=teacher)).json()
    assert detail["student_name"] == "Aziza Karimova" and detail["tasks"][2]["response_id"] is None
    assert (await client.get(f"/teacher/review/writing/{sa}", headers=teacher)).status_code == 404

    bad = {**SCORES, "pronunciation": 10}
    assert (await client.post(f"/teacher/review/speaking/{sa}", headers=teacher, json=bad)).status_code == 422
    assert (await client.post(f"/teacher/review/speaking/{sa}", headers=student, json=SCORES)).status_code == 403

    r = await client.post(f"/teacher/review/speaking/{sa}", headers=teacher, json={**SCORES, "feedback": "Speak more."})
    assert r.status_code == 200 and r.json()["band_score"] == "6.5"
    attempt = (await client.get(f"/attempts/{content['attempt_id']}", headers=student)).json()
    assert attempt["status"] == "finished"
    result = (await client.get(f"/speaking/{sa}/result", headers=student)).json()
    assert result["status"] == "assessed"
    assert result["assessment"]["feedback"] == "Speak more." and result["assessment"]["grader_name"] == "Tina Teacher"

    # повторная оценка заменяет прежнюю
    again = (await client.post(f"/teacher/review/speaking/{sa}", headers=teacher, json={k: 7 for k in SCORES})).json()
    assert again["band_score"] == "7.0" and again["assessment"]["feedback"] is None
    assert (await client.get("/teacher/review", headers=teacher)).json() == []

    progress = (await client.get("/users/me/progress", headers=student)).json()
    assert progress["sections"]["speaking"][0]["band"] == "7.0"


async def test_speaking_needs_open_section(client, student, teacher, published_test, sql):
    content = await start_speaking(client, student, published_test["id"])
    sa, task = content["section_attempt_id"], content["tasks"][0]["id"]
    assert (await client.get(f"/speaking/{sa}/result", headers=student)).status_code == 409
    assert (await client.get(f"/teacher/review/speaking/{sa}", headers=teacher)).status_code == 409

    sql("UPDATE section_attempts SET started_at = now() - interval '1 hour' WHERE id = :id", id=sa)
    r = await answer(client, student, sa, task)
    assert r.status_code == 409 and "Time is up" in r.text
    queue = (await client.get("/teacher/review", headers=teacher)).json()
    assert queue[0]["answered"] == 0


async def test_full_exam_gets_overall_band(client, student, teacher, published_test):
    attempt = (await client.post("/attempts", headers=student, json={"test_id": published_test["id"]})).json()
    for section in ("listening", "reading", "writing"):
        sa = (await client.post(f"/{section}/attempts/{attempt['id']}/start", headers=student)).json()[
            "section_attempt_id"
        ]
        await client.post(f"/{section}/{sa}/submit", headers=student)
    content = await start_speaking(client, student, published_test["id"], attempt_id=attempt["id"])
    sa = content["section_attempt_id"]
    await answer(client, student, sa, content["tasks"][0]["id"])
    await client.post(f"/speaking/{sa}/submit", headers=student)

    state = (await client.get(f"/attempts/{attempt['id']}", headers=student)).json()
    assert state["status"] == "pending_review" and state["next_section"] is None
    queue = (await client.get("/teacher/review", headers=teacher)).json()
    assert {q["section_type"] for q in queue} == {"writing", "speaking"}

    writing_sa = next(q["section_attempt_id"] for q in queue if q["section_type"] == "writing")
    tasks = (await client.get(f"/teacher/review/writing/{writing_sa}", headers=teacher)).json()["tasks"]
    scores = {"task_response": 5, "coherence_cohesion": 5, "lexical_resource": 5, "grammatical_range": 5}
    await client.post(
        f"/teacher/review/writing/{writing_sa}",
        headers=teacher,
        json={"tasks": [{"task_id": t["task_id"], **scores} for t in tasks]},
    )
    await client.post(f"/teacher/review/speaking/{sa}", headers=teacher, json={k: 7 for k in SCORES})

    state = (await client.get(f"/attempts/{attempt['id']}", headers=student)).json()
    bands = {s["section_type"]: float(s["band_score"]) for s in state["sections"]}
    assert state["status"] == "finished" and bands["writing"] == 5.0 and bands["speaking"] == 7.0
    expected = sum(bands.values()) / 4
    assert abs(float(state["overall_band"]) - expected) <= 0.25


async def test_speaking_question_needs_editable_test(client, teacher, sql):
    test = await build_test(client, teacher, sql)  # опубликован
    tasks = (await client.get(f"/teacher/sections/{test['sections']['speaking']}", headers=teacher)).json()[
        "speaking_tasks"
    ]
    r = await client.patch(f"/teacher/speaking-tasks/{tasks[0]['id']}", headers=teacher, json={"prompt": "x"})
    assert r.status_code == 409
