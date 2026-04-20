"""add manager relation for users

Revision ID: 0002_add_user_manager
Revises: 0001_init
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_add_user_manager"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("manager_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_manager_id_users",
        "users",
        "users",
        ["manager_id"],
        ["id"],
    )
    op.create_index("ix_users_manager_id", "users", ["manager_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_manager_id", table_name="users")
    op.drop_constraint("fk_users_manager_id_users", "users", type_="foreignkey")
    op.drop_column("users", "manager_id")
