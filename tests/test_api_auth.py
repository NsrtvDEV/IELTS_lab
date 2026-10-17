from tests.conftest import PASSWORD


async def test_register_validation_and_duplicates(client):
    body = {"email": "Stud@Mail.com", "password": PASSWORD, "first_name": "  Ali ", "last_name": "Valiev"}
    r = await client.post("/auth/register", json={**body, "first_name": "   "})
    assert r.status_code == 422  # имя из одних пробелов
    r = await client.post("/auth/register", json={k: v for k, v in body.items() if k != "last_name"})
    assert r.status_code == 422  # фамилия обязательна
    r = await client.post("/auth/register", json={**body, "password": "short"})
    assert r.status_code == 422

    r = await client.post("/auth/register", json=body)
    assert r.status_code == 201
    assert r.json()["email"] == "stud@mail.com"
    r = await client.post("/auth/register", json={**body, "email": "STUD@mail.com"})
    assert r.status_code == 409


async def test_login_me_and_profile(client, student):
    r = await client.get("/users/me", headers=student)
    assert r.status_code == 200
    me = r.json()
    assert me["role"] == "student"
    assert me["profile"]["first_name"] == "Aziza"

    r = await client.patch("/users/me", headers=student, json={"last_name": "Karimova-Ali", "native_language": "uz"})
    assert r.json()["profile"]["last_name"] == "Karimova-Ali"
    assert r.json()["profile"]["first_name"] == "Aziza"

    r = await client.post("/auth/login", json={"email": "student@example.com", "password": "wrong-pass"})
    assert r.status_code == 401
    assert (await client.get("/users/me")).status_code == 401


async def test_refresh_rotation_and_reuse_detection(client, student):
    r = await client.post("/auth/login", json={"email": "student@example.com", "password": PASSWORD})
    first = r.json()["refresh_token"]

    r = await client.post("/auth/refresh", json={"refresh_token": first})
    assert r.status_code == 200
    second = r.json()["refresh_token"]

    # повторное использование старого токена — отзываем всю цепочку
    assert (await client.post("/auth/refresh", json={"refresh_token": first})).status_code == 401
    assert (await client.post("/auth/refresh", json={"refresh_token": second})).status_code == 401


async def test_blocked_user_cannot_login(client, student, sql):
    sql("UPDATE users SET is_active = false WHERE email = 'student@example.com'")
    r = await client.post("/auth/login", json={"email": "student@example.com", "password": PASSWORD})
    assert r.status_code == 403
    assert (await client.get("/users/me", headers=student)).status_code == 401
