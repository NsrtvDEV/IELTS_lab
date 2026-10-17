from .attempts import router as attempts_router
from .auth import auth_router, register_router
from .reading import router as reading_router
from .teacher import teacher_content_router, teacher_tests_router
from .tests import router as tests_router
from .users import router as users_router

__all__ = [
    "attempts_router",
    "auth_router",
    "reading_router",
    "register_router",
    "teacher_content_router",
    "teacher_tests_router",
    "tests_router",
    "users_router",
]
