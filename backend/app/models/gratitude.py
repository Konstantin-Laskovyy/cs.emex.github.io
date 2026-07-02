from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class EmployeeGratitude(Base):
    __tablename__ = "employee_gratitudes"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recipient = relationship("User", back_populates="received_gratitudes", foreign_keys=[recipient_id])
    author = relationship("User", back_populates="authored_gratitudes", foreign_keys=[author_id])
    likes = relationship("EmployeeGratitudeLike", back_populates="gratitude", cascade="all, delete-orphan")


class EmployeeGratitudeLike(Base):
    __tablename__ = "employee_gratitude_likes"
    __table_args__ = (
        UniqueConstraint("gratitude_id", "user_id", name="uq_employee_gratitude_like_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    gratitude_id: Mapped[int] = mapped_column(ForeignKey("employee_gratitudes.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    gratitude = relationship("EmployeeGratitude", back_populates="likes")
    user = relationship("User", back_populates="gratitude_likes")
