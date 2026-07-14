"""add courier givn analytics

Revision ID: 0019_courier_givn_analytics
Revises: 0018_add_user_work_schedule
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0019_courier_givn_analytics"
down_revision = "0018_add_user_work_schedule"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "courier_givn_daily_stats",
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("total_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("stat_date"),
    )

    op.create_table(
        "courier_givn_courier_daily_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("courier_code", sa.String(length=64), nullable=False),
        sa.Column("courier_name", sa.String(length=160), nullable=False),
        sa.Column("total_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stat_date", "courier_code", name="uq_courier_givn_courier_daily_stats_date_courier"),
    )
    op.create_index(op.f("ix_courier_givn_courier_daily_stats_id"), "courier_givn_courier_daily_stats", ["id"], unique=False)
    op.create_index(
        op.f("ix_courier_givn_courier_daily_stats_stat_date"),
        "courier_givn_courier_daily_stats",
        ["stat_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_courier_givn_courier_daily_stats_courier_code"),
        "courier_givn_courier_daily_stats",
        ["courier_code"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_courier_givn_courier_daily_stats_courier_code"), table_name="courier_givn_courier_daily_stats")
    op.drop_index(op.f("ix_courier_givn_courier_daily_stats_stat_date"), table_name="courier_givn_courier_daily_stats")
    op.drop_index(op.f("ix_courier_givn_courier_daily_stats_id"), table_name="courier_givn_courier_daily_stats")
    op.drop_table("courier_givn_courier_daily_stats")
    op.drop_table("courier_givn_daily_stats")
