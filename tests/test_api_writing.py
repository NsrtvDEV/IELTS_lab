"""Writing: задания учителя, письмо ученика, очередь проверки и оценка по критериям."""

from tests.conftest import build_test

TEXT_1 = "The chart shows " + "word " * 160
TEXT_2 = "Some people think " + "word " * 260
SCORES_1 = {"task_response": 6, "coherence_cohesion": 6, "lexical_resource": 7, "grammatical_range": 6}  # 6.25 -> 6.5
SCORES_2 = {"task_response": 7, "coherence_cohesion": 7, "lexical_resource": 7, "grammatical_range": 6}  # 6.75 -> 7.0


async def start_writing(client, headers, test_id):
    attempt = (await client.post("/attempts", headers=headers, json={"test_id": test_id, "section_type": "writing"})).json()
    r = await client.post(f"/writing/attempts/{attempt['id']}/start", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def write_and_submit(client, student, test_id, texts=(TEXT_1, TEXT_2)):
    content = await start_writing(client, student, test_id)
    sa = content["section_attempt_id"]
    for task, text in zip(content["tasks"], texts):
        if text is not None:
            r = await client.put(f"/writing/{sa}/tasks/{task['id']}", headers=student, json={"text": text})
            assert r.status_code == 200
    assert (await client.post(f"/writing/{sa}/submit", headers=student)).status_code == 200
    return content


def assessment(content, s1=SCORES_1, s2=SCORES_2, feedback="Good structure, work on grammar."):
    t1, t2 = content["tasks"]
    return {"tasks": [{"task_id": t1["id"], **s1, "feedback": feedback}, {"task_id": t2["id"], **s2}]}


async def test_teacher_writing_tasks(client, teacher, student):
    test = (await client.post("/teacher/tests", headers=teacher, json={"title": "T"})).json()
    sec = {s["type"]: s["id"] for s in test["sections"]}
    url = f"/teacher/sections/{sec['writing']}/writing-tasks"

    r = await client.post(url, headers=teacher, json={"task_number": 1, "prompt": "  The chart shows sales.  "})
    task1 = r.json()
    assert r.status_code == 201
    assert (task1["prompt"], task1["min_words"], task1["recommended_min"]) == ("The chart shows sales.", 150, 20)
    r = await client.post(url, headers=teacher, json={"task_number": 2, "prompt": "Discuss.", "min_words": 260})
    assert (r.json()["min_words"], r.json()["recommended_min"]) == (260, 40)

    assert (await client.post(url, headers=teacher, json={"task_number": 1, "prompt": "x"})).status_code == 400
    assert (await client.post(url, headers=teacher, json={"task_number": 3, "prompt": "x"})).status_code == 422
    r = await client.post(f"/teacher/sections/{sec['reading']}/writing-tasks", headers=teacher, json={"task_number": 1, "prompt": "x"})
    assert r.status_code == 400
    assert (await client.post(url, headers=student, json={"task_number": 1, "prompt": "x"})).status_code == 403

    r = await client.patch(f"/teacher/writing-tasks/{task1['id']}", headers=teacher, json={"prompt": "New", "image_url": "/media/images/x.png"})
    assert r.json()["prompt"] == "New" and r.json()["image_url"] == "/media/images/x.png"
    content = (await client.get(f"/teacher/sections/{sec['writing']}", headers=teacher)).json()
    assert [t["task_number"] for t in content["writing_tasks"]] == [1, 2]

    problems = (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"]
    assert not any(p.startswith("writing") for p in problems)
    assert (await client.delete(f"/teacher/writing-tasks/{task1['id']}", headers=teacher)).status_code == 204
    problems = (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"]
    assert "writing: Task 1 and Task 2 are required" in problems


async def test_student_writes_and_teacher_assesses(client, student, teacher, published_test):
    content = await start_writing(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    assert [t["task_number"] for t in content["tasks"]] == [1, 2]
    t1, t2 = content["tasks"]

    r = await client.put(f"/writing/{sa}/tasks/{t1['id']}", headers=student, json={"text": "One two  three\nfour"})
    assert r.json()["word_count"] == 4  # число слов считает сервер
    await client.put(f"/writing/{sa}/tasks/{t1['id']}", headers=student, json={"text": TEXT_1})
    assert (await client.put(f"/writing/{sa}/tasks/999999", headers=student, json={"text": "x"})).status_code == 404

    resumed = (await client.get(f"/writing/{sa}", headers=student)).json()
    assert resumed["responses"] == [{"task_id": t1["id"], "text": TEXT_1, "word_count": 163}]

    # Task 2 не написан — при сдаче он всё равно уходит на проверку пустым
    await client.post(f"/writing/{sa}/submit", headers=student)
    attempt = (await client.get(f"/attempts/{content['attempt_id']}", headers=student)).json()
    assert attempt["status"] == "pending_review"
    result = (await client.get(f"/writing/{sa}/result", headers=student)).json()
    assert result["status"] == "pending" and result["band_score"] is None
    assert [t["word_count"] for t in result["tasks"]] == [163, 0]

    queue = (await client.get("/teacher/review", headers=teacher)).json()
    assert len(queue) == 1
    assert queue[0]["student_name"] == "Aziza Karimova" and queue[0]["word_counts"] == [163, 0]

    detail = (await client.get(f"/teacher/review/writing/{sa}", headers=teacher)).json()
    assert detail["tasks"][0]["text"] == TEXT_1

    one_task = {"tasks": [{"task_id": t1["id"], **SCORES_1}]}
    assert (await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=one_task)).status_code == 400
    bad = assessment(content, s1={**SCORES_1, "task_response": 10})
    assert (await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=bad)).status_code == 422
    assert (await client.post(f"/teacher/review/writing/{sa}", headers=student, json=assessment(content))).status_code == 403

    r = await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=assessment(content))
    assessed = r.json()
    assert r.status_code == 200
    assert [t["assessment"]["band"] for t in assessed["tasks"]] == ["6.5", "7.0"]
    assert assessed["band_score"] == "7.0"  # (6.5 + 2 × 7.0) / 3 = 6.83 -> 7.0

    attempt = (await client.get(f"/attempts/{content['attempt_id']}", headers=student)).json()
    assert attempt["status"] == "finished"
    result = (await client.get(f"/writing/{sa}/result", headers=student)).json()
    assert result["status"] == "assessed"
    task1 = result["tasks"][0]["assessment"]
    assert task1["feedback"] == "Good structure, work on grammar." and task1["grader_name"] == "Tina Teacher"

    assert (await client.get("/teacher/review", headers=teacher)).json() == []
    assert len((await client.get("/teacher/review", headers=teacher, params={"status": "assessed"})).json()) == 1

    # повторная оценка заменяет прежнюю
    lower = assessment(content, s1={k: 5 for k in SCORES_1}, s2={k: 5 for k in SCORES_2})
    again = (await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=lower)).json()
    assert again["band_score"] == "5.0"

    progress = (await client.get("/users/me/progress", headers=student)).json()
    assert progress["sections"]["writing"][0]["band"] == "5.0"


async def test_results_are_private_and_need_submission(client, student, make_user, teacher, published_test):
    content = await start_writing(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    assert (await client.get(f"/writing/{sa}/result", headers=student)).status_code == 409
    assert (await client.get(f"/teacher/review/writing/{sa}", headers=teacher)).status_code == 409
    other = await make_user("other@example.com")
    assert (await client.get(f"/writing/{sa}", headers=other)).status_code == 404


async def test_expired_writing_goes_to_review(client, student, teacher, published_test, sql):
    content = await start_writing(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    await client.put(f"/writing/{sa}/tasks/{content['tasks'][0]['id']}", headers=student, json={"text": "Late essay"})
    sql("UPDATE section_attempts SET started_at = now() - interval '2 hours' WHERE id = :id", id=sa)
    r = await client.put(f"/writing/{sa}/tasks/{content['tasks'][0]['id']}", headers=student, json={"text": "more"})
    assert r.status_code == 409 and "Time is up" in r.text
    queue = (await client.get("/teacher/review", headers=teacher)).json()
    assert queue[0]["word_counts"] == [2, 0]  # сохранённое до конца времени


async def test_abandoned_work_is_not_reviewed(client, student, teacher, published_test):
    content = await write_and_submit(client, student, published_test["id"])
    attempt = (await client.post("/attempts", headers=student, json={"test_id": published_test["id"], "section_type": "writing"})).json()
    await client.post(f"/writing/attempts/{attempt['id']}/start", headers=student)
    await client.post(f"/attempts/{attempt['id']}/abandon", headers=student)
    queue = (await client.get("/teacher/review", headers=teacher)).json()
    assert [q["section_attempt_id"] for q in queue] == [content["section_attempt_id"]]


async def test_full_exam_reaches_speaking_after_writing(client, student, teacher, published_test):
    attempt = (await client.post("/attempts", headers=student, json={"test_id": published_test["id"]})).json()
    for section in ("listening", "reading"):
        sa = (await client.post(f"/{section}/attempts/{attempt['id']}/start", headers=student)).json()["section_attempt_id"]
        await client.post(f"/{section}/{sa}/submit", headers=student)
    content = (await client.post(f"/writing/attempts/{attempt['id']}/start", headers=student)).json()
    await client.post(f"/writing/{content['section_attempt_id']}/submit", headers=student)
    state = (await client.get(f"/attempts/{attempt['id']}", headers=student)).json()
    assert state["next_section"] == "speaking" and state["status"] == "in_progress"
    queue = (await client.get("/teacher/review", headers=teacher)).json()
    assert queue[0]["mode"] == "mock"


async def test_writing_task_needs_editable_test(client, teacher, sql):
    test = await build_test(client, teacher, sql)  # опубликован
    tasks = (await client.get(f"/teacher/sections/{test['sections']['writing']}", headers=teacher)).json()["writing_tasks"]
    r = await client.patch(f"/teacher/writing-tasks/{tasks[0]['id']}", headers=teacher, json={"prompt": "x"})
    assert r.status_code == 409


async def test_inline_comments_on_essay(client, student, teacher, published_test):
    essay = "The chart shows visitors. Their was a big rise in 2019."
    content = await write_and_submit(client, student, published_test["id"], texts=(essay, TEXT_2))
    sa = content["section_attempt_id"]
    t1, t2 = content["tasks"]
    start = essay.index("Their was")
    comment = {"start": start, "end": start + len("Their was"), "quote": "Their was", "text": "There was — wrong word."}
    second = {"start": 0, "end": 9, "quote": "The chart", "text": "Good opening."}

    def body(comments):
        return {"tasks": [{"task_id": t1["id"], **SCORES_1, "comments": comments}, {"task_id": t2["id"], **SCORES_2}]}

    r = await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=body([comment, second]))
    assert r.status_code == 200, r.text
    result = (await client.get(f"/writing/{sa}/result", headers=student)).json()
    saved = result["tasks"][0]["assessment"]["comments"]
    assert [c["quote"] for c in saved] == ["The chart", "Their was"]  # по порядку в тексте
    assert saved[1]["text"] == "There was — wrong word."
    assert result["tasks"][1]["assessment"]["comments"] == []

    wrong_quote = {**comment, "quote": "They were"}
    r = await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=body([wrong_quote]))
    assert r.status_code == 400 and "doesn't match" in r.text
    overlap = {"start": start + 2, "end": start + 9, "quote": essay[start + 2:start + 9], "text": "x"}
    r = await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=body([comment, overlap]))
    assert r.status_code == 400 and "overlap" in r.text
    outside = {"start": 0, "end": len(essay) + 5, "quote": essay, "text": "x"}
    assert (await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=body([outside]))).status_code == 400

    # повторная оценка без комментариев их убирает
    await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=body([]))
    result = (await client.get(f"/writing/{sa}/result", headers=student)).json()
    assert result["tasks"][0]["assessment"]["comments"] == []
