"""add courier city branch fields

Revision ID: 0020_city_branch_fields
Revises: 0019_courier_givn_analytics
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_city_branch_fields"
down_revision = "0019_courier_givn_analytics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("courier_city_daily_stats", sa.Column("branch_code", sa.String(length=64), nullable=True))
    op.add_column("courier_city_daily_stats", sa.Column("branch_name", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("courier_city_daily_stats", "branch_name")
    op.drop_column("courier_city_daily_stats", "branch_code")
