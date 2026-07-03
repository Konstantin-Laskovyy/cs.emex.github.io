from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(String(3000), nullable=True)
    documents: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")
    projects: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")

    parent: Mapped["Department | None"] = relationship(remote_side="Department.id")
    manager: Mapped["User | None"] = relationship("User", foreign_keys=[manager_id])
    users: Mapped[list["User"]] = relationship(
        back_populates="department",
        foreign_keys="User.department_id",
    )

