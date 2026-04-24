"""add department manager

Revision ID: 0005_add_department_manager
Revises: 0004_add_user_role
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_add_department_manager"
down_revision = "0004_add_user_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("manager_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_departments_manager_id_users",
        "departments",
        "users",
        ["manager_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_departments_manager_id_users", "departments", type_="foreignkey")
    op.drop_column("departments", "manager_id")
