"""Уведомления: новый тест, работа на проверку, оценка, сдача по времени, напоминание учителю."""

SCORES = {"task_response": 6, "coherence_cohesion": 6, "lexical_resource": 7, "grammatical_range": 6}


async def inbox(client, headers):
    r = await client.get("/notifications", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def submit_writing(client, student, test_id):
    attempt = (
        await client.post("/attempts", headers=student, json={"test_id": test_id, "section_type": "writing"})
    ).json()
    content = (await client.post(f"/writing/attempts/{attempt['id']}/start", headers=student)).json()
    sa = content["section_attempt_id"]
    await client.put(f"/writing/{sa}/tasks/{content['tasks'][0]['id']}", headers=student, json={"text": "Some essay"})
    assert (await client.post(f"/writing/{sa}/submit", headers=student)).status_code == 200
    return attempt["id"], sa, content["tasks"]


async def test_new_test_is_announced_to_students(client, student, teacher, published_test):
    data = await inbox(client, student)
    assert data["unread"] == 1
    assert data["items"][0]["kind"] == "test_published" and data["items"][0]["link"] == "/tests"
    assert "Mock 1" in data["items"][0]["text"]
    assert (await inbox(client, teacher))["unread"] == 0  # учителям — нет

    # снять с публикации и опубликовать снова — без дубля
    await client.post(f"/teacher/tests/{published_test['id']}/unpublish", headers=teacher)
    await client.post(f"/teacher/tests/{published_test['id']}/publish", headers=teacher)
    assert (await inbox(client, student))["unread"] == 1


async def test_review_flow(client, student, teacher, make_user, published_test):
    other_teacher = await make_user("t2@example.com", role="teacher")
    _, sa, tasks = await submit_writing(client, student, published_test["id"])

    for headers in (teacher, other_teacher):
        items = (await inbox(client, headers))["items"]
        assert items[0]["kind"] == "review_submitted"
        assert items[0]["text"] == "Aziza Karimova submitted Writing — waiting for review"
        assert items[0]["params"] == {"section": "writing", "name": "Aziza Karimova"}
        assert items[0]["link"] == f"/teacher/review/writing/{sa}"

    body = {"tasks": [{"task_id": t["id"], **SCORES} for t in tasks]}
    assert (await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=body)).status_code == 200

    # оценили — у всех учителей уведомление о работе пропало, ученику пришла оценка
    for headers in (teacher, other_teacher):
        assert not [n for n in (await inbox(client, headers))["items"] if n["kind"] == "review_submitted"]
    latest = (await inbox(client, student))["items"][0]
    assert latest["kind"] == "assessed" and latest["text"] == "Your Writing has been assessed — band 6.5"
    assert latest["params"] == {"section": "writing", "band": "6.5", "updated": False}
    assert latest["link"] == f"/writing/{sa}/result"

    body = {"tasks": [{"task_id": t["id"], **{k: 7 for k in SCORES}} for t in tasks]}
    await client.post(f"/teacher/review/writing/{sa}", headers=teacher, json=body)
    assert (await inbox(client, student))["items"][0]["text"] == "Your Writing assessment was updated — band 7.0"


async def test_speaking_submission_and_assessment(client, student, teacher, published_test):
    attempt = (
        await client.post(
            "/attempts", headers=student, json={"test_id": published_test["id"], "section_type": "speaking"}
        )
    ).json()
    sa = (await client.post(f"/speaking/attempts/{attempt['id']}/start", headers=student)).json()["section_attempt_id"]
    await client.post(f"/speaking/{sa}/submit", headers=student)
    assert (await inbox(client, teacher))["items"][0]["link"] == f"/teacher/review/speaking/{sa}"
    scores = {"fluency_coherence": 6, "lexical_resource": 6, "grammatical_range": 6, "pronunciation": 7}
    await client.post(f"/teacher/review/speaking/{sa}", headers=teacher, json=scores)
    assert (await inbox(client, student))["items"][0]["text"] == "Your Speaking has been assessed — band 6.5"


async def test_abandoned_mock_removes_review_notification(client, student, teacher, published_test):
    attempt = (await client.post("/attempts", headers=student, json={"test_id": published_test["id"]})).json()
    for section in ("listening", "reading", "writing"):
        sa = (await client.post(f"/{section}/attempts/{attempt['id']}/start", headers=student)).json()[
            "section_attempt_id"
        ]
        await client.post(f"/{section}/{sa}/submit", headers=student)
    assert any(n["kind"] == "review_submitted" for n in (await inbox(client, teacher))["items"])
    await client.post(f"/attempts/{attempt['id']}/abandon", headers=student)
    assert not any(n["kind"] == "review_submitted" for n in (await inbox(client, teacher))["items"])


async def test_timed_out_section_notifies_student(client, student, teacher, published_test, sql):
    attempt = (
        await client.post(
            "/attempts", headers=student, json={"test_id": published_test["id"], "section_type": "reading"}
        )
    ).json()
    sa = (await client.post(f"/reading/attempts/{attempt['id']}/start", headers=student)).json()["section_attempt_id"]
    sql("UPDATE section_attempts SET started_at = now() - interval '2 hours' WHERE id = :id", id=sa)
    await client.get(f"/attempts/{attempt['id']}", headers=student)  # сервер закрывает просроченную секцию
    latest = (await inbox(client, student))["items"][0]
    assert latest["kind"] == "auto_submitted"
    assert latest["text"] == "Time ran out — your Reading was submitted automatically"
    assert latest["link"] == f"/reading/{sa}/result"
    # Reading учителю не отправляется
    assert not any(n["kind"] == "review_submitted" for n in (await inbox(client, teacher))["items"])


async def test_teacher_reminder_for_old_works(client, student, teacher, published_test, sql):
    _, sa, _ = await submit_writing(client, student, published_test["id"])
    assert not any(n["kind"] == "review_waiting" for n in (await inbox(client, teacher))["items"])
    sql("UPDATE section_attempts SET submitted_at = now() - interval '3 days' WHERE id = :id", id=sa)
    items = (await inbox(client, teacher))["items"]
    reminders = [n for n in items if n["kind"] == "review_waiting"]
    assert len(reminders) == 1
    assert reminders[0]["text"] == "1 work has been waiting for review for more than 2 days"
    assert reminders[0]["params"] == {"count": 1}
    assert (
        len([n for n in (await inbox(client, teacher))["items"] if n["kind"] == "review_waiting"]) == 1
    )  # не чаще раза в сутки


async def test_read_and_read_all(client, student, teacher, make_user, published_test):
    await submit_writing(client, student, published_test["id"])
    data = await inbox(client, student)
    first = data["items"][0]
    r = await client.post(f"/notifications/{first['id']}/read", headers=student)
    assert r.status_code == 200 and r.json()["read"] is True
    assert (await inbox(client, student))["unread"] == data["unread"] - 1

    other = await make_user("other@example.com")
    assert (await client.post(f"/notifications/{first['id']}/read", headers=other)).status_code == 404

    assert (await inbox(client, teacher))["unread"] >= 1
    assert (await client.post("/notifications/read-all", headers=teacher)).status_code == 204
    assert (await inbox(client, teacher))["unread"] == 0
    assert (await client.get("/notifications")).status_code == 401
