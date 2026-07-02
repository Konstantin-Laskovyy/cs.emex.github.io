"""add employee gratitudes

Revision ID: 0014_add_employee_gratitudes
Revises: 0013_add_chat_messages
Create Date: 2026-07-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_add_employee_gratitudes"
down_revision = "0013_add_chat_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "employee_gratitudes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_gratitudes_author_id", "employee_gratitudes", ["author_id"])
    op.create_index("ix_employee_gratitudes_recipient_id", "employee_gratitudes", ["recipient_id"])

    op.create_table(
        "employee_gratitude_likes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gratitude_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["gratitude_id"], ["employee_gratitudes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gratitude_id", "user_id", name="uq_employee_gratitude_like_user"),
    )
    op.create_index("ix_employee_gratitude_likes_gratitude_id", "employee_gratitude_likes", ["gratitude_id"])
    op.create_index("ix_employee_gratitude_likes_user_id", "employee_gratitude_likes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_employee_gratitude_likes_user_id", table_name="employee_gratitude_likes")
    op.drop_index("ix_employee_gratitude_likes_gratitude_id", table_name="employee_gratitude_likes")
    op.drop_table("employee_gratitude_likes")
    op.drop_index("ix_employee_gratitudes_recipient_id", table_name="employee_gratitudes")
    op.drop_index("ix_employee_gratitudes_author_id", table_name="employee_gratitudes")
    op.drop_table("employee_gratitudes")
