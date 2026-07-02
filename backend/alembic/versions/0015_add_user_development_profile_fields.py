"""add user development profile fields

Revision ID: 0015_add_user_development_profile_fields
Revises: 0014_add_employee_gratitudes
Create Date: 2026-07-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_add_user_development_profile_fields"
down_revision = "0014_add_employee_gratitudes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("education_records", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("users", sa.Column("additional_education_records", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("users", sa.Column("certificate_records", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("users", sa.Column("course_records", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("users", sa.Column("skills", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("users", sa.Column("achievement_records", sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "achievement_records")
    op.drop_column("users", "skills")
    op.drop_column("users", "course_records")
    op.drop_column("users", "certificate_records")
    op.drop_column("users", "additional_education_records")
    op.drop_column("users", "education_records")
