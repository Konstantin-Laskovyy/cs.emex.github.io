"""add department content fields

Revision ID: 0016_department_content_fields
Revises: 0015_user_development_fields
Create Date: 2026-07-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_department_content_fields"
down_revision = "0015_user_development_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("description", sa.String(length=3000), nullable=True))
    op.add_column("departments", sa.Column("documents", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("departments", sa.Column("projects", sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    op.drop_column("departments", "projects")
    op.drop_column("departments", "documents")
    op.drop_column("departments", "description")
