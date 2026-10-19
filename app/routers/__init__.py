from .admin import router as admin_router
from .attempts import router as attempts_router
from .auth import auth_router, password_reset_router, register_router
from .listening import router as listening_router
from .notifications import router as notifications_router
from .reading import router as reading_router
from .site import router as site_router
from .speaking import router as speaking_router
from .stats import router as stats_router
from .teacher import (
    teacher_content_router,
    teacher_dashboard_router,
    teacher_profile_router,
    teacher_review_router,
    teacher_students_router,
    teacher_tests_router,
    teacher_uploads_router,
)
from .tests import router as tests_router
from .users import router as users_router
from .writing import router as writing_router

__all__ = [
    "admin_router",
    "attempts_router",
    "auth_router",
    "password_reset_router",
    "listening_router",
    "notifications_router",
    "reading_router",
    "site_router",
    "register_router",
    "speaking_router",
    "stats_router",
    "teacher_content_router",
    "teacher_dashboard_router",
    "teacher_profile_router",
    "teacher_review_router",
    "teacher_students_router",
    "teacher_tests_router",
    "teacher_uploads_router",
    "tests_router",
    "users_router",
    "writing_router",
]
