"""add user hr dashboard fields

Revision ID: 0010_user_hr_dashboard
Revises: 0009_city_daily_stats
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_user_hr_dashboard"
down_revision = "0009_city_daily_stats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("hire_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("vacation_days_total", sa.Integer(), server_default="24", nullable=False))
    op.add_column("users", sa.Column("vacation_days_used", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("vacation_periods", sa.JSON(), server_default=sa.text("'[]'::json"), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "vacation_periods")
    op.drop_column("users", "vacation_days_used")
    op.drop_column("users", "vacation_days_total")
    op.drop_column("users", "hire_date")
