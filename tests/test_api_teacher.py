"""API учителя: тесты, группы вопросов, картинки, публикация, ученики, дашборд."""

import pytest

from tests.conftest import build_test
from tests.test_api_reading import by_number, option_id, start_reading

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


async def test_only_teachers(client, student):
    assert (await client.post("/teacher/tests", headers=student, json={"title": "x"})).status_code == 403
    assert (await client.get("/teacher/students", headers=student)).status_code == 403
    assert (await client.get("/teacher/dashboard", headers=student)).status_code == 403


async def test_new_test_has_four_sections(client, teacher):
    r = await client.post("/teacher/tests", headers=teacher, json={"title": "  Cambridge 19 "})
    test = r.json()
    assert r.status_code == 201 and test["title"] == "Cambridge 19"
    assert [(s["type"], s["duration_min"]) for s in test["sections"]] == [
        ("listening", 30),
        ("reading", 60),
        ("writing", 60),
        ("speaking", 14),
    ]
    assert len(test["problems"]) == 5
    assert "listening: add the recordings (Part 1–4)" in test["problems"]
    r = await client.post(f"/teacher/tests/{test['id']}/publish", headers=teacher)
    assert r.status_code == 409


async def make_section(client, teacher):
    test = (await client.post("/teacher/tests", headers=teacher, json={"title": "T"})).json()
    return {s["type"]: s["id"] for s in test["sections"]}


@pytest.mark.parametrize(
    "body, message",
    [
        ({"type": "gap_fill", "questions": [{"number": 1}]}, "either correct_options or correct_texts"),
        (
            {
                "type": "mcq",
                "questions": [
                    {
                        "number": 1,
                        "options": [{"label": "A", "text": "a"}],
                        "correct_options": ["A"],
                        "correct_texts": ["a"],
                    }
                ],
            },
            "either",
        ),
        (
            {
                "type": "mcq",
                "questions": [{"number": 1, "options": [{"label": "A", "text": "a"}], "correct_options": ["Z"]}],
            },
            "unknown option",
        ),
        (
            {
                "type": "mcq",
                "questions": [
                    {
                        "number": 1,
                        "options": [{"label": "A", "text": "a"}, {"label": "B", "text": "b"}],
                        "correct_options": ["A", "B"],
                    }
                ],
            },
            "exactly 1",
        ),
        ({"type": "tfng", "questions": [{"number": 1, "correct_texts": ["TRUE"]}]}, "needs correct_options"),
        (
            {
                "type": "short_answer",
                "options": [{"label": "A", "text": "a"}],
                "questions": [{"number": 1, "correct_options": ["A"]}],
            },
            "answered with text",
        ),
        ({"type": "gap_fill", "passage_id": 999_999, "questions": [{"number": 1, "correct_texts": ["a"]}]}, "Passage"),
        (
            {
                "type": "mcq",
                "word_limit": 2,
                "questions": [{"number": 1, "options": [{"label": "A", "text": "a"}], "correct_options": ["A"]}],
            },
            "word_limit",
        ),
        (
            {
                "type": "gap_fill",
                "questions": [{"number": 1, "correct_texts": ["a"]}, {"number": 1, "correct_texts": ["b"]}],
            },
            "unique",
        ),
    ],
)
async def test_invalid_question_groups_rejected(client, teacher, body, message):
    sec = await make_section(client, teacher)
    r = await client.post(
        f"/teacher/sections/{sec['reading']}/question-groups", headers=teacher, json={"instruction": "x", **body}
    )
    assert r.status_code == 400, r.text
    assert message in r.json()["detail"]


async def test_question_numbers_are_unique_per_section(client, teacher):
    sec = await make_section(client, teacher)
    group = {"type": "gap_fill", "instruction": "x", "questions": [{"number": 1, "correct_texts": ["a"]}]}
    url = f"/teacher/sections/{sec['reading']}/question-groups"
    created = (await client.post(url, headers=teacher, json=group)).json()
    r = await client.post(url, headers=teacher, json=group)
    assert r.status_code == 400 and "already used" in r.text
    # замена группы может оставить свои же номера
    r = await client.put(f"/teacher/question-groups/{created['id']}", headers=teacher, json=group)
    assert r.status_code == 200


async def test_tfng_options_are_created_automatically(client, teacher):
    sec = await make_section(client, teacher)
    r = await client.post(
        f"/teacher/sections/{sec['reading']}/question-groups",
        headers=teacher,
        json={"type": "ynng", "instruction": "x", "questions": [{"number": 1, "correct_options": ["NOT GIVEN"]}]},
    )
    assert [o["label"] for o in r.json()["options"]] == ["YES", "NO", "NOT GIVEN"]


async def test_summary_completion_with_word_list(client, teacher, student, sql):
    """ "Complete the summary using the list of words A–F" — ответ буквой."""
    test = await build_test(client, teacher, sql, publish=False)
    sec = test["sections"]["reading"]
    groups = (await client.get(f"/teacher/sections/{sec}", headers=teacher)).json()["question_groups"]
    gap = next(g for g in groups if g["type"] == "gap_fill")
    # заменяем Q7–40 на summary со списком слов
    r = await client.put(
        f"/teacher/question-groups/{gap['id']}",
        headers=teacher,
        json={
            "type": "summary_completion",
            "instruction": "Questions 7–40. Choose from the box.",
            "options": [{"label": L, "text": f"word {L}"} for L in "ABCDEF"],
            "questions": [{"number": n, "text": f"gap {n}", "correct_options": ["C"]} for n in range(7, 41)],
        },
    )
    assert r.status_code == 200, r.text
    await client.post(f"/teacher/tests/{test['id']}/publish", headers=teacher)

    content = await start_reading(client, student, test["id"])
    q = by_number(content)
    sa = content["section_attempt_id"]
    await client.put(
        f"/reading/{sa}/answers",
        headers=student,
        json={
            "answers": [
                {"question_id": q[7][0]["id"], "option_ids": [option_id(*q[7], "C")]},
                {"question_id": q[8][0]["id"], "option_ids": [option_id(*q[8], "A")]},
            ]
        },
    )
    await client.post(f"/reading/{sa}/submit", headers=student)
    result = (await client.get(f"/reading/{sa}/result", headers=student)).json()
    assert result["correct_count"] == 1


async def test_image_upload_and_group_image(client, teacher, student, sql):
    r = await client.post("/teacher/uploads/images", headers=teacher, files={"file": ("plan.png", PNG, "image/png")})
    assert r.status_code == 201
    url = r.json()["url"]
    assert url.startswith("/media/images/") and url.endswith(".png")
    assert (await client.get(f"http://test{url}")).status_code == 200

    r = await client.post("/teacher/uploads/images", headers=teacher, files={"file": ("x.txt", b"hi", "text/plain")})
    assert r.status_code == 415
    r = await client.post("/teacher/uploads/images", headers=student, files={"file": ("plan.png", PNG, "image/png")})
    assert r.status_code == 403

    test = await build_test(client, teacher, sql, publish=False)
    sec = test["sections"]["reading"]
    first = (await client.get(f"/teacher/sections/{sec}", headers=teacher)).json()["question_groups"][0]
    body = {k: first[k] for k in ("passage_id", "type", "instruction", "position")}
    body["questions"] = [
        {"number": q["number"], "text": q["text"], "correct_options": q["correct_options"]} for q in first["questions"]
    ]
    r = await client.put(f"/teacher/question-groups/{first['id']}", headers=teacher, json={**body, "image_url": url})
    assert r.json()["image_url"] == url
    await client.post(f"/teacher/tests/{test['id']}/publish", headers=teacher)

    content = await start_reading(client, student, test["id"])
    assert any(g["image_url"] == url for g in content["question_groups"])


async def test_publish_and_editing_locks(client, teacher, student, sql):
    test = await build_test(client, teacher, sql, publish=False)
    assert (await client.get(f"/teacher/tests/{test['id']}", headers=teacher)).json()["problems"] == []
    assert (await client.post(f"/teacher/tests/{test['id']}/publish", headers=teacher)).status_code == 200
    assert len((await client.get("/tests", headers=student)).json()) == 1

    sec = test["sections"]["reading"]
    r = await client.post(f"/teacher/sections/{sec}/passages", headers=teacher, json={"text": "x"})
    assert r.status_code == 409 and "Unpublish" in r.text
    r = await client.patch(f"/teacher/tests/{test['id']}", headers=teacher, json={"title": "Renamed"})
    assert r.status_code == 200  # название можно менять всегда

    await start_reading(client, student, test["id"])
    await client.post(f"/teacher/tests/{test['id']}/unpublish", headers=teacher)
    r = await client.post(f"/teacher/sections/{sec}/passages", headers=teacher, json={"text": "x"})
    assert r.status_code == 409 and "already took" in r.text
    assert (await client.delete(f"/teacher/tests/{test['id']}", headers=teacher)).status_code == 409


async def test_delete_draft_cascades(client, teacher, sql):
    test = (await client.post("/teacher/tests", headers=teacher, json={"title": "Draft"})).json()
    assert (await client.delete(f"/teacher/tests/{test['id']}", headers=teacher)).status_code == 204
    assert sql("SELECT count(*) FROM sections WHERE test_id = :t", t=test["id"]).scalar() == 0


async def test_students_list_detail_and_result(client, teacher, student, make_user, published_test):
    other = await make_user("bob@example.com", first_name="Bob", last_name="Smith")
    content = await start_reading(client, student, published_test["id"])
    sa = content["section_attempt_id"]
    q = by_number(content)
    await client.put(
        f"/reading/{sa}/answers",
        headers=student,
        json={"answers": [{"question_id": q[1][0]["id"], "option_ids": [option_id(*q[1], "TRUE")]}]},
    )
    await client.post(f"/reading/{sa}/submit", headers=student)

    students = (await client.get("/teacher/students", headers=teacher)).json()
    assert [s["name"] for s in students] == ["Aziza Karimova", "Bob Smith"]  # активные первыми
    aziza = students[0]
    assert aziza["sections_completed"] == 1 and aziza["bands"] == {"reading": "1.0"}

    found = (await client.get("/teacher/students", headers=teacher, params={"q": "smi"})).json()
    assert [s["name"] for s in found] == ["Bob Smith"]

    detail = (await client.get(f"/teacher/students/{aziza['id']}", headers=teacher)).json()
    item = detail["history"][0]
    assert item["section_attempt_id"] == sa and item["mode"] == "section" and item["raw_score"] == 1

    result = (await client.get(f"/teacher/students/{aziza['id']}/results/{sa}", headers=teacher)).json()
    assert result["correct_count"] == 1 and result["questions"][0]["correct_answers"] == ["TRUE"]

    bob_id = students[1]["id"]
    assert (await client.get(f"/teacher/students/{bob_id}/results/{sa}", headers=teacher)).status_code == 404
    assert other  # bob зарегистрирован


async def test_dashboard(client, teacher, student, published_test):
    content = await start_reading(client, student, published_test["id"])
    await client.post(f"/reading/{content['section_attempt_id']}/submit", headers=student)
    d = (await client.get("/teacher/dashboard", headers=teacher)).json()
    assert d["stats"]["total_students"]["value"] == 1
    assert d["stats"]["published_tests"]["value"] == 1
    assert d["students"][0]["name"] == "Aziza Karimova"
    assert d["tests"][0]["questions"] == 80
