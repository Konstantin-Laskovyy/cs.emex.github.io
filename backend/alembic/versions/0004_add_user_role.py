"""add user role

Revision ID: 0004_add_user_role
Revises: 0003_add_news_posts
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_add_user_role"
down_revision = "0003_add_news_posts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=40), server_default="employee", nullable=False),
    )
    op.create_index("ix_users_role", "users", ["role"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")
