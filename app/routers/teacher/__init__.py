from .content import router as teacher_content_router
from .dashboard import router as teacher_dashboard_router
from .profile import router as teacher_profile_router
from .review import router as teacher_review_router
from .students import router as teacher_students_router
from .tests import router as teacher_tests_router
from .uploads import router as teacher_uploads_router

__all__ = [
    "teacher_content_router",
    "teacher_dashboard_router",
    "teacher_profile_router",
    "teacher_review_router",
    "teacher_students_router",
    "teacher_tests_router",
    "teacher_uploads_router",
]
