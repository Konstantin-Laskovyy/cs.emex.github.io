"""add app settings

Revision ID: 0006_add_app_settings
Revises: 0005_add_department_manager
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_add_app_settings"
down_revision = "0005_add_department_manager"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("key"),
    )
    op.bulk_insert(
        sa.table(
            "app_settings",
            sa.column("key", sa.String(length=120)),
            sa.column("value", sa.Text()),
        ),
        [
            {"key": "org_root_name", "value": "ТОО «EMEX»"},
            {"key": "org_root_manager_id", "value": None},
        ],
    )


def downgrade() -> None:
    op.drop_table("app_settings")
