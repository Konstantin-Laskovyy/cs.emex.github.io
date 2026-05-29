"""add user zup fields

Revision ID: 0011_add_user_zup_fields
Revises: 0010_add_user_hr_dashboard_fields
Create Date: 2026-05-29 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_add_user_zup_fields"
down_revision = "0010_add_user_hr_dashboard_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("iin", sa.String(length=12), nullable=True))
    op.create_index("ix_users_iin", "users", ["iin"], unique=False)
    op.add_column("users", sa.Column("zup_last_vacation_info", sa.String(length=1000), nullable=True))
    op.add_column("users", sa.Column("zup_source_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "zup_source_updated_at")
    op.drop_column("users", "zup_last_vacation_info")
    op.drop_index("ix_users_iin", table_name="users")
    op.drop_column("users", "iin")
