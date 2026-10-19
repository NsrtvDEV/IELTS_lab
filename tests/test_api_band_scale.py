"""Шкала raw → band из миграции совпадает с официальной таблицей IELTS Academic."""

from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models import SectionType
from app.scoring import band_from_raw

# официальные диапазоны (ielts.org, «IELTS scoring in detail»): (от, до, band)
LISTENING = [
    (39, 40, "9.0"),
    (37, 38, "8.5"),
    (35, 36, "8.0"),
    (32, 34, "7.5"),
    (30, 31, "7.0"),
    (26, 29, "6.5"),
    (23, 25, "6.0"),
    (18, 22, "5.5"),
    (16, 17, "5.0"),
    (13, 15, "4.5"),
    (10, 12, "4.0"),
]
READING = [
    (39, 40, "9.0"),
    (37, 38, "8.5"),
    (35, 36, "8.0"),
    (33, 34, "7.5"),
    (30, 32, "7.0"),
    (27, 29, "6.5"),
    (23, 26, "6.0"),
    (19, 22, "5.5"),
    (15, 18, "5.0"),
    (13, 14, "4.5"),
    (10, 12, "4.0"),
]


@pytest.mark.parametrize("section, table", [(SectionType.LISTENING, LISTENING), (SectionType.READING, READING)])
async def test_official_band_ranges(database, section, table):
    async with SessionLocal() as session:
        for low, high, band in table:
            for raw in range(low, high + 1):
                assert await band_from_raw(session, section, raw) == Decimal(band), (section, raw)
