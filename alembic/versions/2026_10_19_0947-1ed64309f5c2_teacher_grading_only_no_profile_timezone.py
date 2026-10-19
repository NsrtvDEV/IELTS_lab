"""teacher grading only, no profile timezone

Revision ID: 1ed64309f5c2
Revises: 24c58a99665a
Create Date: 2026-10-19 09:47:43.883872

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1ed64309f5c2"
down_revision: Union[str, Sequence[str], None] = "24c58a99665a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


GRADER_TYPE = postgresql.ENUM("teacher", "ai", name="grader_type")


def upgrade() -> None:
    """Оценивает только преподаватель (AI-проверки не будет); часовой пояс в профиле не нужен."""
    op.drop_column("speaking_assessments", "grader_type")
    op.drop_column("writing_assessments", "grader_type")
    GRADER_TYPE.drop(op.get_bind())
    op.drop_column("user_profiles", "timezone")


def downgrade() -> None:
    GRADER_TYPE.create(op.get_bind())
    for table in ("writing_assessments", "speaking_assessments"):
        # существующие оценки — от преподавателя
        op.add_column(table, sa.Column("grader_type", GRADER_TYPE, server_default="teacher", nullable=False))
        op.alter_column(table, "grader_type", server_default=None)
    op.add_column(
        "user_profiles",
        sa.Column("timezone", sa.VARCHAR(length=64), server_default="UTC", nullable=False),
    )
