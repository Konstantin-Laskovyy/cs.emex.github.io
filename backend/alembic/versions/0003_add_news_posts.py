"""add news posts

Revision ID: 0003_add_news_posts
Revises: 0002_add_user_manager
Create Date: 2026-04-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_add_news_posts"
down_revision = "0002_add_user_manager"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "news_posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_news_posts_author_id", "news_posts", ["author_id"], unique=False)
    op.create_index("ix_news_posts_title", "news_posts", ["title"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_news_posts_title", table_name="news_posts")
    op.drop_index("ix_news_posts_author_id", table_name="news_posts")
    op.drop_table("news_posts")
