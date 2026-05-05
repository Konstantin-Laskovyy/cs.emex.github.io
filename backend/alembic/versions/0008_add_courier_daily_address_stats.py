"""add courier daily address stats

Revision ID: 0008_add_courier_daily_address_stats
Revises: 0007_add_social_interactions
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_add_courier_daily_address_stats"
down_revision = "0007_add_social_interactions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "courier_daily_address_stats",
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("total_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("pickup_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("waybill_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("stat_date"),
    )


def downgrade() -> None:
    op.drop_table("courier_daily_address_stats")
