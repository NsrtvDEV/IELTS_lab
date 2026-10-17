"""Прохождение Reading учеником: старт, ответы, сдача, результат, таймер."""


async def start_reading(client, headers, test_id):
    attempt = (await client.post("/attempts", headers=headers, json={"test_id": test_id, "section_type": "reading"})).json()
    r = await client.post(f"/reading/attempts/{attempt['id']}/start", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def by_number(content):
    return {q["number"]: (q, g) for g in content["question_groups"] for q in g["questions"]}


def option_id(question, group, label):
    return next(o["id"] for o in question["options"] + group["options"] if o["label"] == label)


async def test_reading_flow_scores_and_result(client, student, make_user, published_test):
    content = await start_reading(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    assert content["attempt_id"] and content["deadline"]
    assert len(content["question_groups"]) == 6
    assert "correct" not in str(content).lower()  # правильные ответы не отдаются до сдачи

    q = by_number(content)
    answers = [
        {"question_id": q[1][0]["id"], "option_ids": [option_id(*q[1], "TRUE")]},  # ✓
        {"question_id": q[2][0]["id"], "option_ids": [option_id(*q[2], "TRUE")]},  # ✗
        {"question_id": q[3][0]["id"], "option_ids": [option_id(*q[3], "B")]},  # ✓
        {"question_id": q[4][0]["id"], "option_ids": [option_id(*q[4], "ii")]},  # ✓
        {"question_id": q[5][0]["id"], "answer_text": "  mesopotamia. "},  # ✓ после нормализации
        {"question_id": q[6][0]["id"], "option_ids": [option_id(*q[6], "A"), option_id(*q[6], "C")]},  # ✓ 2 балла
    ]
    assert (await client.put(f"/reading/{sa}/answers", headers=student, json={"answers": answers})).status_code == 204
    # перезапись того же варианта не ломает сохранение
    assert (await client.put(f"/reading/{sa}/answers", headers=student, json={"answers": answers[-1:]})).status_code == 204

    saved = (await client.get(f"/reading/{sa}", headers=student)).json()["answers"]
    assert len(saved) == 6

    assert (await client.get(f"/reading/{sa}/result", headers=student)).status_code == 409  # ещё не сдано

    r = await client.post(f"/reading/{sa}/submit", headers=student)
    assert r.status_code == 200
    assert r.json()["raw_score"] == 6
    assert r.json()["band_score"] == "3.0"  # шкала из миграции: raw 6 -> 3.0

    result = (await client.get(f"/reading/{sa}/result", headers=student)).json()
    assert result["correct_count"] == 5
    assert result["question_count"] == 40
    assert result["max_score"] == 41
    assert result["test_title"] == "Mock 1"
    q6 = next(x for x in result["questions"] if x["number"] == 6)
    assert q6["earned"] == 2 and q6["your_answer"] == "A, C" and q6["correct_answers"] == ["A", "C"]

    # после сдачи ответы не принимаются
    assert (await client.put(f"/reading/{sa}/answers", headers=student, json={"answers": answers})).status_code == 409

    # попытка по одной секции завершена без overall band
    attempt = (await client.get(f"/attempts/{content['attempt_id']}", headers=student)).json()
    assert attempt["status"] == "finished" and attempt["overall_band"] is None

    progress = (await client.get("/users/me/progress", headers=student)).json()
    assert progress["sections"]["reading"][0]["section_attempt_id"] == sa

    other = await make_user("other@example.com")
    assert (await client.get(f"/reading/{sa}/result", headers=other)).status_code == 404


async def test_answer_validation(client, student, published_test):
    content = await start_reading(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    q = by_number(content)
    three = [option_id(*q[6], L) for L in "ABC"]
    r = await client.put(f"/reading/{sa}/answers", headers=student, json={"answers": [{"question_id": q[6][0]["id"], "option_ids": three}]})
    assert r.status_code == 400  # Choose TWO — не больше двух
    r = await client.put(f"/reading/{sa}/answers", headers=student, json={"answers": [{"question_id": 999_999, "answer_text": "x"}]})
    assert r.status_code == 400
    r = await client.put(f"/reading/{sa}/answers", headers=student, json={"answers": [{"question_id": q[3][0]["id"], "option_ids": [option_id(*q[4], "ii")]}]})
    assert r.status_code == 400  # вариант чужого вопроса


async def test_start_again_continues_same_section(client, student, published_test):
    content = await start_reading(client, student, published_test["id"])
    r = await client.post(f"/reading/attempts/{content['attempt_id']}/start", headers=student)
    assert r.json()["section_attempt_id"] == content["section_attempt_id"]


async def test_full_exam_starts_with_listening(client, student, published_test):
    attempt = (await client.post("/attempts", headers=student, json={"test_id": published_test["id"]})).json()
    assert attempt["next_section"] == "listening"
    r = await client.post(f"/reading/attempts/{attempt['id']}/start", headers=student)
    assert r.status_code == 409


async def test_expired_section_is_auto_submitted(client, student, published_test, sql):
    content = await start_reading(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    sql("UPDATE section_attempts SET started_at = now() - interval '2 hours' WHERE id = :id", id=sa)

    r = await client.put(f"/reading/{sa}/answers", headers=student, json={"answers": []})
    assert r.status_code == 409 and "Time is up" in r.text
    result = (await client.get(f"/reading/{sa}/result", headers=student)).json()
    assert result["correct_count"] == 0
    attempt = (await client.get(f"/attempts/{content['attempt_id']}", headers=student)).json()
    section = attempt["sections"][0]
    assert section["submitted_at"] == section["deadline"]  # сдачей считается конец таймера


async def test_abandon_attempt(client, student, published_test):
    content = await start_reading(client, student, published_test["id"])
    r = await client.post(f"/attempts/{content['attempt_id']}/abandon", headers=student)
    assert r.status_code == 200 and r.json()["status"] == "abandoned"
    r = await client.get(f"/reading/{content['section_attempt_id']}", headers=student)
    assert r.status_code == 409 and "not in progress" in r.text


async def test_unpublished_test_is_hidden(client, student, teacher, sql):
    from tests.conftest import build_test

    test = await build_test(client, teacher, sql, publish=False)
    assert (await client.get("/tests", headers=student)).json() == []
    r = await client.post("/attempts", headers=student, json={"test_id": test["id"], "section_type": "reading"})
    assert r.status_code == 404
