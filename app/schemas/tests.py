from pydantic import BaseModel, ConfigDict

from app.models import SectionType


class SectionShort(BaseModel):
    type: SectionType
    duration_min: int

    model_config = ConfigDict(from_attributes=True)


class TestResponse(BaseModel):
    __test__ = False

    id: int
    title: str
    sections: list[SectionShort]
    completed_sections: list[SectionType] = []  # секции, которые ученик уже сдал

    model_config = ConfigDict(from_attributes=True)
