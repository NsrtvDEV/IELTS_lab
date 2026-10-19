"""band conversion surrogate id

Revision ID: 5a688244f511
Revises: 52151d738c26
Create Date: 2026-10-17 21:28:37.139089

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5a688244f511"
down_revision: Union[str, Sequence[str], None] = "52151d738c26"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Обычный id вместо составного PK — Django-админка не умеет составные ключи."""
    op.drop_constraint("pk_band_conversion", "band_conversion", type_="primary")
    op.execute("ALTER TABLE band_conversion ADD COLUMN id SERIAL")
    op.create_primary_key("pk_band_conversion", "band_conversion", ["id"])
    op.create_unique_constraint(
        op.f("uq_band_conversion_section_type"),
        "band_conversion",
        ["section_type", "raw_score"],
    )


def downgrade() -> None:
    op.drop_constraint(op.f("uq_band_conversion_section_type"), "band_conversion", type_="unique")
    op.drop_constraint("pk_band_conversion", "band_conversion", type_="primary")
    op.drop_column("band_conversion", "id")
    op.create_primary_key("pk_band_conversion", "band_conversion", ["section_type", "raw_score"])
