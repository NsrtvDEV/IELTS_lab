"""Публичная статистика для главной страницы."""


async def test_public_stats_counts_real_data(client, student, make_user, published_test):
    attempt = (
        await client.post(
            "/attempts", headers=student, json={"test_id": published_test["id"], "section_type": "reading"}
        )
    ).json()
    sa = (await client.post(f"/reading/attempts/{attempt['id']}/start", headers=student)).json()["section_attempt_id"]
    assert (await client.post(f"/reading/{sa}/submit", headers=student)).status_code == 200

    # сданная секция прерванного полного экзамена не считается
    quitter = await make_user("quitter@example.com")
    attempt = (await client.post("/attempts", headers=quitter, json={"test_id": published_test["id"]})).json()
    sa = (await client.post(f"/listening/attempts/{attempt['id']}/start", headers=quitter)).json()["section_attempt_id"]
    assert (await client.post(f"/listening/{sa}/submit", headers=quitter)).status_code == 200
    assert (await client.post(f"/attempts/{attempt['id']}/abandon", headers=quitter)).status_code == 200

    r = await client.get("/stats")  # без токена
    assert r.status_code == 200, r.text
    # учитель из published_test учеником не считается
    assert r.json() == {"students": 2, "tests": 1, "sections_completed": 1}
