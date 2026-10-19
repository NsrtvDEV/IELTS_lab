"""academic mock only

Revision ID: e6d0cc75e203
Revises: 9def0ac3d9fa
Create Date: 2026-10-17 20:57:21.136172

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e6d0cc75e203"
down_revision: Union[str, Sequence[str], None] = "9def0ac3d9fa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TEST_TYPE = postgresql.ENUM("academic", "general", name="test_type")
# для колонок: сам тип создаётся/удаляется явно через TEST_TYPE
TEST_TYPE_COL = postgresql.ENUM(name="test_type", create_type=False)


def upgrade() -> None:
    """Только IELTS Academic, все тесты — полные mock-экзамены."""
    # шкалы General больше не нужны; без них PK (section_type, raw_score) уникален
    op.execute("DELETE FROM band_conversion WHERE test_type = 'general'")
    # удаление колонки из PK удаляет и сам PK — создаём новый
    op.drop_column("band_conversion", "test_type")
    op.create_primary_key("pk_band_conversion", "band_conversion", ["section_type", "raw_score"])
    op.create_check_constraint(
        op.f("ck_band_conversion_section_type_scored"),
        "band_conversion",
        "section_type IN ('listening', 'reading')",
    )

    op.drop_column("tests", "is_mock")
    op.drop_column("tests", "type")
    TEST_TYPE.drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    """Возвращает тип теста; существующие строки становятся academic."""
    TEST_TYPE.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "tests",
        sa.Column("type", TEST_TYPE_COL, server_default="academic", nullable=False),
    )
    op.alter_column("tests", "type", server_default=None)
    op.add_column(
        "tests",
        sa.Column("is_mock", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )

    op.drop_constraint(op.f("ck_band_conversion_section_type_scored"), "band_conversion")
    op.drop_constraint("pk_band_conversion", "band_conversion", type_="primary")
    op.add_column(
        "band_conversion",
        sa.Column("test_type", TEST_TYPE_COL, server_default="academic", nullable=False),
    )
    op.alter_column("band_conversion", "test_type", server_default=None)
    op.create_primary_key(
        "pk_band_conversion",
        "band_conversion",
        ["section_type", "test_type", "raw_score"],
    )
