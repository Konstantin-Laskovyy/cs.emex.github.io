from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, func
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
    received_gratitudes: Mapped[list["EmployeeGratitude"]] = relationship(
        "EmployeeGratitude",
        back_populates="recipient",
        cascade="all, delete-orphan",
        foreign_keys="EmployeeGratitude.recipient_id",
    )
    authored_gratitudes: Mapped[list["EmployeeGratitude"]] = relationship(
        "EmployeeGratitude",
        back_populates="author",
        cascade="all, delete-orphan",
        foreign_keys="EmployeeGratitude.author_id",
    )
    gratitude_likes: Mapped[list["EmployeeGratitudeLike"]] = relationship(
        "EmployeeGratitudeLike",
        back_populates="user",
        cascade="all, delete-orphan",
    )
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
    iin: Mapped[str | None] = mapped_column(String(12), nullable=True, index=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    vacation_days_total: Mapped[int] = mapped_column(Integer, default=24, server_default="24")
    vacation_days_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    vacation_periods: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")
    education_records: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")
    additional_education_records: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")
    certificate_records: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")
    course_records: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, server_default="[]")
    achievement_records: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")
    zup_last_vacation_info: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    zup_source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    role: Mapped[str] = mapped_column(String(40), default="employee", server_default="employee")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    access_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

