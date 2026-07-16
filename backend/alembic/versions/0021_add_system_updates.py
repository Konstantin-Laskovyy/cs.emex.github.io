"""add system updates

Revision ID: 0021_add_system_updates
Revises: 0020_city_branch_fields
Create Date: 2026-07-16
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_add_system_updates"
down_revision = "0020_city_branch_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_updates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_system_updates_author_id"), "system_updates", ["author_id"], unique=False)
    op.create_index(op.f("ix_system_updates_title"), "system_updates", ["title"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_system_updates_title"), table_name="system_updates")
    op.drop_index(op.f("ix_system_updates_author_id"), table_name="system_updates")
    op.drop_table("system_updates")
