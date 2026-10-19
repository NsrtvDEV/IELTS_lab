"""Настройки безопасности: CORS, заголовки файлов /media, запрет небезопасных настроек на сервере."""

from pathlib import Path

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.main import app

STRONG = "x" * 40


@pytest.fixture
async def raw():
    """Клиент без префикса /api/v1 — для /media."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_cors_only_for_the_frontend(raw):
    allowed = settings.CORS_ORIGINS[0]
    r = await raw.options("/api/v1/auth/login", headers={"Origin": allowed, "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") == allowed
    r = await raw.options(
        "/api/v1/auth/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in r.headers


async def test_media_files_cannot_run_scripts(raw):
    folder = Path(settings.MEDIA_ROOT, "images")
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "evil.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    r = await raw.get("/media/images/evil.svg")
    assert r.status_code == 200
    assert "sandbox" in r.headers["content-security-policy"]
    assert "default-src 'none'" in r.headers["content-security-policy"]
    assert r.headers["x-content-type-options"] == "nosniff"


def make(**overrides):
    base = dict(
        PROJECT_NAME="t",
        DEBUG=False,
        SECRET_KEY=STRONG,
        ADMIN_SECRET_KEY="y" * 40,
        DB_USER="u",
        DB_PASSWORD="p",
        DB_HOST="h",
        DB_PORT=5432,
        DB_NAME="d",
        CORS_ORIGINS=["https://bandup.uz"],
        FRONTEND_URL="https://bandup.uz",
    )
    return Settings(_env_file=None, **{**base, **overrides})


def test_production_settings_are_checked():
    make()  # всё в порядке
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        make(SECRET_KEY="short")
    with pytest.raises(ValidationError, match="ADMIN_SECRET_KEY"):
        make(ADMIN_SECRET_KEY=STRONG)  # совпадает с SECRET_KEY
    with pytest.raises(ValidationError, match="ADMIN_SECRET_KEY"):
        make(ADMIN_SECRET_KEY="")
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        make(CORS_ORIGINS=["*"])
    with pytest.raises(ValidationError, match="FRONTEND_URL"):
        make(FRONTEND_URL="http://localhost:5173")
    make(DEBUG=True, SECRET_KEY="dev", ADMIN_SECRET_KEY="", CORS_ORIGINS=["*"])  # локально можно
