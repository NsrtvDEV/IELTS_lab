from app.models import SectionType
from app.routers.question_sections import make_router

router = make_router(SectionType.READING, "3 текста и 40 вопросов, 60 минут")
