from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.courier_analytics import CourierCityDailyStat, CourierDailyAddressStat
from app.models.user import User
from app.schemas.analytics import CityDailyCount, DailyOrderCount, OrdersSummary


router = APIRouter(prefix="/analytics", tags=["analytics"])

METRIC_DELIVERY_WAYBILLS = "delivery_waybills"
METRIC_ACCEPTED_PICKUPS = "accepted_pickups"


def _empty_daily(stat_date: date) -> DailyOrderCount:
    return DailyOrderCount(date=stat_date, count=0, pickup_count=0, waybill_count=0)


def _city_daily(item: CourierCityDailyStat) -> CityDailyCount:
    return CityDailyCount(
        date=item.stat_date,
        city_code=item.city_code,
        city_name=item.city_name,
        count=item.total_count,
    )


@router.get("/orders/summary", response_model=OrdersSummary)
def get_orders_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> OrdersSummary:
    today = date.today()
    month_start = today.replace(day=1)

    stats = (
        db.query(CourierDailyAddressStat)
        .filter(
            CourierDailyAddressStat.stat_date >= month_start,
            CourierDailyAddressStat.stat_date <= today,
        )
        .order_by(CourierDailyAddressStat.stat_date.asc())
        .all()
    )
    stats_by_date = {item.stat_date: item for item in stats}
    today_stat = stats_by_date.get(today)

    month_total, month_pickups, month_waybills = (
        db.query(
            func.coalesce(func.sum(CourierDailyAddressStat.total_count), 0),
            func.coalesce(func.sum(CourierDailyAddressStat.pickup_count), 0),
            func.coalesce(func.sum(CourierDailyAddressStat.waybill_count), 0),
        )
        .filter(
            CourierDailyAddressStat.stat_date >= month_start,
            CourierDailyAddressStat.stat_date <= today,
        )
        .one()
    )
    city_stats = (
        db.query(CourierCityDailyStat)
        .filter(
            CourierCityDailyStat.stat_date >= month_start,
            CourierCityDailyStat.stat_date <= today,
        )
        .order_by(
            CourierCityDailyStat.stat_date.desc(),
            CourierCityDailyStat.total_count.desc(),
            CourierCityDailyStat.city_name.asc(),
        )
        .all()
    )

    return OrdersSummary(
        today=today,
        month_start=month_start,
        today_count=today_stat.total_count if today_stat else 0,
        month_count=int(month_total or 0),
        today_pickup_count=today_stat.pickup_count if today_stat else 0,
        today_waybill_count=today_stat.waybill_count if today_stat else 0,
        month_pickup_count=int(month_pickups or 0),
        month_waybill_count=int(month_waybills or 0),
        daily=[
            DailyOrderCount(
                date=item.stat_date,
                count=item.total_count,
                pickup_count=item.pickup_count,
                waybill_count=item.waybill_count,
            )
            for item in stats
        ]
        or [_empty_daily(today)],
        delivery_by_city=[_city_daily(item) for item in city_stats if item.metric_type == METRIC_DELIVERY_WAYBILLS],
        accepted_by_city=[_city_daily(item) for item in city_stats if item.metric_type == METRIC_ACCEPTED_PICKUPS],
    )
