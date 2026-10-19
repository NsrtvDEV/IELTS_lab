from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import settings
from app.limiter import limiter
from app.routers import (
    admin_router,
    attempts_router,
    auth_router,
    listening_router,
    notifications_router,
    password_reset_router,
    reading_router,
    register_router,
    site_router,
    speaking_router,
    stats_router,
    teacher_content_router,
    teacher_dashboard_router,
    teacher_profile_router,
    teacher_review_router,
    teacher_students_router,
    teacher_tests_router,
    teacher_uploads_router,
    tests_router,
    users_router,
    writing_router,
)

app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    description="Mock-тесты IELTS Academic: Listening, Reading, Writing, Speaking",
    version="1.0.0",
    # на сервере (DEBUG=0) документацию API не показываем
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # только адрес фронтенда (токен передаётся в заголовке, не в cookie)
    allow_methods=["*"],
    allow_headers=["*"],
)

# Файлы из /media открываются и напрямую по ссылке. SVG может содержать скрипт —
# запрещаем странице файла выполнять что-либо и угадывать тип содержимого
MEDIA_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"


@app.middleware("http")
async def media_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/media/"):
        response.headers["Content-Security-Policy"] = MEDIA_CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# за nginx: настоящий IP клиента из X-Forwarded-For (для лимитов на вход) — только от доверенного прокси.
# Добавляется последним, чтобы выполняться первым
if settings.TRUSTED_PROXIES:
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.TRUSTED_PROXIES)

API_PREFIX = "/api/v1"

for router in (
    auth_router,
    register_router,
    password_reset_router,
    users_router,
    notifications_router,
    stats_router,
    site_router,
    tests_router,
    attempts_router,
    listening_router,
    reading_router,
    writing_router,
    speaking_router,
    teacher_dashboard_router,
    teacher_profile_router,
    teacher_review_router,
    teacher_students_router,
    teacher_tests_router,
    teacher_content_router,
    teacher_uploads_router,
    admin_router,
):
    app.include_router(router, prefix=API_PREFIX)


# картинки и записи тестов — публичные (это содержимое тестов, а не ответы учеников); фото профилей тоже
for folder in ("images", "audio", "avatars"):
    Path(settings.MEDIA_ROOT, folder).mkdir(parents=True, exist_ok=True)
    app.mount(f"/media/{folder}", StaticFiles(directory=Path(settings.MEDIA_ROOT, folder)), name=folder)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}
