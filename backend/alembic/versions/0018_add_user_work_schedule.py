"""add user work schedule

Revision ID: 0018_add_user_work_schedule
Revises: 0017_add_user_work_status
Create Date: 2026-07-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0018_add_user_work_schedule"
down_revision = "0017_add_user_work_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("workday_start", sa.String(length=5), server_default="09:00", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("workday_end", sa.String(length=5), server_default="18:00", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "workday_end")
    op.drop_column("users", "workday_start")
