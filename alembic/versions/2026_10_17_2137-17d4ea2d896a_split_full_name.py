"""split full name

Revision ID: 17d4ea2d896a
Revises: 5a688244f511
Create Date: 2026-10-17 21:37:18.127237

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "17d4ea2d896a"
down_revision: Union[str, Sequence[str], None] = "5a688244f511"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """full_name → first_name + last_name (первое слово — имя, остальное — фамилия)."""
    op.add_column("user_profiles", sa.Column("first_name", sa.String(100), nullable=True))
    op.add_column("user_profiles", sa.Column("last_name", sa.String(100), nullable=True))
    op.execute(
        r"""
        UPDATE user_profiles SET
            first_name = left(nullif(split_part(trim(full_name), ' ', 1), ''), 100),
            last_name = left(nullif(regexp_replace(trim(full_name), '^\S+\s*', ''), ''), 100)
        WHERE full_name IS NOT NULL
        """
    )
    op.drop_column("user_profiles", "full_name")


def downgrade() -> None:
    op.add_column("user_profiles", sa.Column("full_name", sa.String(255), nullable=True))
    op.execute("UPDATE user_profiles SET full_name = nullif(concat_ws(' ', first_name, last_name), '')")
    op.drop_column("user_profiles", "last_name")
    op.drop_column("user_profiles", "first_name")
