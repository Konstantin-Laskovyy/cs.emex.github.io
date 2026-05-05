"""add courier city daily stats

Revision ID: 0009_city_daily_stats
Revises: 0008_courier_daily_stats
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_city_daily_stats"
down_revision = "0008_courier_daily_stats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "courier_city_daily_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("metric_type", sa.String(length=32), nullable=False),
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("city_code", sa.String(length=64), nullable=False),
        sa.Column("city_name", sa.String(length=160), nullable=False),
        sa.Column("total_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("metric_type", "stat_date", "city_code", name="uq_courier_city_daily_stats_metric_date_city"),
    )
    op.create_index(op.f("ix_courier_city_daily_stats_id"), "courier_city_daily_stats", ["id"], unique=False)
    op.create_index(op.f("ix_courier_city_daily_stats_metric_type"), "courier_city_daily_stats", ["metric_type"], unique=False)
    op.create_index(op.f("ix_courier_city_daily_stats_stat_date"), "courier_city_daily_stats", ["stat_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_courier_city_daily_stats_stat_date"), table_name="courier_city_daily_stats")
    op.drop_index(op.f("ix_courier_city_daily_stats_metric_type"), table_name="courier_city_daily_stats")
    op.drop_index(op.f("ix_courier_city_daily_stats_id"), table_name="courier_city_daily_stats")
    op.drop_table("courier_city_daily_stats")
