"""section attempts, simpler profile

Revision ID: e20ac0d3198c
Revises: e6d0cc75e203
Create Date: 2026-10-17 21:09:24.145086

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e20ac0d3198c'
down_revision: Union[str, Sequence[str], None] = 'e6d0cc75e203'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Попытка по одной секции; из профиля убраны target_band и exam_date."""
    # тип section_type уже существует — колонке не нужно его создавать
    op.add_column(
        "test_attempts",
        sa.Column(
            "section_type",
            postgresql.ENUM(name="section_type", create_type=False),
            nullable=True,
        ),
    )
    op.create_check_constraint(
        op.f("ck_test_attempts_overall_band_full_only"),
        "test_attempts",
        "section_type IS NULL OR overall_band IS NULL",
    )
    # CHECK на target_band удаляется вместе с колонкой
    op.drop_column("user_profiles", "exam_date")
    op.drop_column("user_profiles", "target_band")


def downgrade() -> None:
    op.add_column(
        "user_profiles", sa.Column("target_band", sa.Numeric(2, 1), nullable=True)
    )
    op.add_column("user_profiles", sa.Column("exam_date", sa.Date(), nullable=True))
    op.create_check_constraint(
        op.f("ck_user_profiles_target_band_range"),
        "user_profiles",
        "target_band >= 0 AND target_band <= 9 "
        "AND target_band * 2 = floor(target_band * 2)",
    )
    op.drop_constraint(
        op.f("ck_test_attempts_overall_band_full_only"), "test_attempts"
    )
    op.drop_column("test_attempts", "section_type")
