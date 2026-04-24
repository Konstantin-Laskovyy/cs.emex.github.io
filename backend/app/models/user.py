from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))

    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)

    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    department = relationship("Department", back_populates="users", foreign_keys=[department_id])
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    manager: Mapped["User | None"] = relationship(
        "User",
        remote_side="User.id",
        back_populates="reports",
        foreign_keys=[manager_id],
    )
    reports: Mapped[list["User"]] = relationship(
        "User",
        back_populates="manager",
        foreign_keys="User.manager_id",
    )
    news_posts: Mapped[list["NewsPost"]] = relationship(
        "NewsPost",
        back_populates="author",
        cascade="all, delete-orphan",
    )
    news_comments: Mapped[list["NewsComment"]] = relationship("NewsComment", back_populates="author")
    news_reactions: Mapped[list["NewsReaction"]] = relationship("NewsReaction", back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification",
        back_populates="recipient",
        cascade="all, delete-orphan",
        foreign_keys="Notification.recipient_id",
    )

    avatar_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(100), nullable=True)

    role: Mapped[str] = mapped_column(String(40), default="employee", server_default="employee")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

