from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CourierDailyAddressStat(Base):
    __tablename__ = "courier_daily_address_stats"

    stat_date: Mapped[date] = mapped_column(Date, primary_key=True)
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pickup_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    waybill_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
