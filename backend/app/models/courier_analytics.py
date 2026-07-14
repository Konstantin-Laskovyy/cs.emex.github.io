from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, UniqueConstraint, func
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


class CourierCityDailyStat(Base):
    __tablename__ = "courier_city_daily_stats"
    __table_args__ = (
        UniqueConstraint("metric_type", "stat_date", "city_code", name="uq_courier_city_daily_stats_metric_date_city"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    metric_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    stat_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    city_code: Mapped[str] = mapped_column(String(64), nullable=False)
    city_name: Mapped[str] = mapped_column(String(160), nullable=False)
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CourierGivnDailyStat(Base):
    __tablename__ = "courier_givn_daily_stats"

    stat_date: Mapped[date] = mapped_column(Date, primary_key=True)
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    total_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CourierGivnCourierDailyStat(Base):
    __tablename__ = "courier_givn_courier_daily_stats"
    __table_args__ = (
        UniqueConstraint("stat_date", "courier_code", name="uq_courier_givn_courier_daily_stats_date_courier"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    stat_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    courier_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    courier_name: Mapped[str] = mapped_column(String(160), nullable=False)
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    total_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
