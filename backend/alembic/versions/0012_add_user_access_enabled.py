"""add user portal access flag

Revision ID: 0012_add_user_access_enabled
Revises: 0011_add_user_zup_fields
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_add_user_access_enabled"
down_revision = "0011_add_user_zup_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("access_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "access_enabled")
