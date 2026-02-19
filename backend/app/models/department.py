from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)

    parent: Mapped["Department | None"] = relationship(remote_side="Department.id")

