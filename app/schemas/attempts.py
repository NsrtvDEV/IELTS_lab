from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models import AttemptStatus, SectionType


class AttemptCreate(BaseModel):
    test_id: int
    # не указано — полный экзамен из 4 секций; указано — только эта секция
    section_type: SectionType | None = None


class SectionAttemptShort(BaseModel):
    id: int
    section_type: SectionType
    started_at: datetime
    deadline: datetime
    submitted_at: datetime | None = None
    raw_score: int | None = None
    band_score: Decimal | None = None


class AttemptResponse(BaseModel):
    id: int
    test_id: int
    test_title: str
    section_type: SectionType | None
    status: AttemptStatus
    started_at: datetime
    finished_at: datetime | None = None
    overall_band: Decimal | None = None
    sections: list[SectionAttemptShort]
    next_section: SectionType | None = None  # какую секцию можно начать следующей
