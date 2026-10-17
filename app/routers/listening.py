from app.models import SectionType
from app.routers.question_sections import make_router

router = make_router(SectionType.LISTENING, "4 записи и 40 вопросов, около 30 минут")
