"""add social interactions

Revision ID: 0007_add_social_interactions
Revises: 0006_add_app_settings
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_add_social_interactions"
down_revision = "0006_add_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "news_comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("news_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["news_id"], ["news_posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_news_comments_author_id", "news_comments", ["author_id"], unique=False)
    op.create_index("ix_news_comments_news_id", "news_comments", ["news_id"], unique=False)

    op.create_table(
        "news_reactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("news_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reaction", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["news_id"], ["news_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("news_id", "user_id", "reaction", name="uq_news_reaction_user_type"),
    )
    op.create_index("ix_news_reactions_news_id", "news_reactions", ["news_id"], unique=False)
    op.create_index("ix_news_reactions_reaction", "news_reactions", ["reaction"], unique=False)
    op.create_index("ix_news_reactions_user_id", "news_reactions", ["user_id"], unique=False)

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("body", sa.String(length=500), nullable=False),
        sa.Column("link", sa.String(length=500), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"], unique=False)
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_id", table_name="notifications")
    op.drop_index("ix_notifications_is_read", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_news_reactions_user_id", table_name="news_reactions")
    op.drop_index("ix_news_reactions_reaction", table_name="news_reactions")
    op.drop_index("ix_news_reactions_news_id", table_name="news_reactions")
    op.drop_table("news_reactions")
    op.drop_index("ix_news_comments_news_id", table_name="news_comments")
    op.drop_index("ix_news_comments_author_id", table_name="news_comments")
    op.drop_table("news_comments")
