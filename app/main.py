from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.limiter import limiter
from app.routers import (
    attempts_router,
    auth_router,
    reading_router,
    register_router,
    teacher_content_router,
    teacher_dashboard_router,
    teacher_students_router,
    teacher_tests_router,
    teacher_uploads_router,
    tests_router,
    users_router,
)

app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    description="Mock-тесты IELTS Academic: Listening, Reading, Writing, Speaking",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: заменить на домен фронтенда перед продакшеном
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

for router in (
    auth_router,
    register_router,
    users_router,
    tests_router,
    attempts_router,
    reading_router,
    teacher_dashboard_router,
    teacher_students_router,
    teacher_tests_router,
    teacher_content_router,
    teacher_uploads_router,
):
    app.include_router(router, prefix=API_PREFIX)


# картинки к вопросам — публичные (это содержимое тестов, а не ответы учеников)
Path(settings.MEDIA_ROOT, "images").mkdir(parents=True, exist_ok=True)
app.mount("/media/images", StaticFiles(directory=Path(settings.MEDIA_ROOT, "images")), name="images")


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}
