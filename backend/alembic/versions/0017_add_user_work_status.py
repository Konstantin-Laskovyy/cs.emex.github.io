"""add user work status

Revision ID: 0017_add_user_work_status
Revises: 0016_department_content_fields
Create Date: 2026-07-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0017_add_user_work_status"
down_revision = "0016_department_content_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("work_status", sa.String(length=40), server_default="working", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "work_status")
