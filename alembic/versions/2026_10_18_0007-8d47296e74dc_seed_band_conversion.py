"""seed band conversion

Revision ID: 8d47296e74dc
Revises: 17d4ea2d896a
Create Date: 2026-10-18 00:07:42.390803

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8d47296e74dc"
down_revision: Union[str, Sequence[str], None] = "17d4ea2d896a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Общепринятые таблицы перевода IELTS Academic (raw 0–40 → band).
# Хранится нижняя граница диапазона: band_from_raw берёт строку с наибольшим
# raw_score <= результата. Значения можно поправить в Django-админке.
LISTENING = {
    0: 0.0,
    1: 1.0,
    2: 2.0,
    4: 2.5,
    6: 3.0,
    8: 3.5,
    10: 4.0,
    13: 4.5,
    16: 5.0,
    18: 5.5,
    23: 6.0,
    26: 6.5,
    30: 7.0,
    32: 7.5,
    35: 8.0,
    37: 8.5,
    39: 9.0,
}
READING = {
    0: 0.0,
    1: 1.0,
    2: 2.0,
    4: 2.5,
    6: 3.0,
    8: 3.5,
    10: 4.0,
    13: 4.5,
    15: 5.0,
    19: 5.5,
    23: 6.0,
    27: 6.5,
    30: 7.0,
    33: 7.5,
    35: 8.0,
    37: 8.5,
    39: 9.0,
}


def rows():
    for section, table in (("listening", LISTENING), ("reading", READING)):
        for raw, band in table.items():
            yield section, raw, band


def upgrade() -> None:
    # уже заданные вручную строки не перезаписываем
    for section, raw, band in rows():
        op.execute(
            sa.text(
                "INSERT INTO band_conversion (section_type, raw_score, band) "
                "VALUES (CAST(:s AS section_type), :r, :b) "
                "ON CONFLICT (section_type, raw_score) DO NOTHING"
            ).bindparams(s=section, r=raw, b=band)
        )


def downgrade() -> None:
    for section, raw, band in rows():
        op.execute(
            sa.text(
                "DELETE FROM band_conversion WHERE section_type = CAST(:s AS section_type) "
                "AND raw_score = :r AND band = :b"
            ).bindparams(s=section, r=raw, b=band)
        )
