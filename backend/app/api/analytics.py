from datetime import date

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_manager_or_admin
from app.db.session import get_db
from app.models.courier_analytics import (
    CourierCityDailyStat,
    CourierDailyAddressStat,
    CourierGivnCourierDailyStat,
    CourierGivnDailyStat,
)
from app.models.user import User
from app.schemas.analytics import CityDailyCount, CourierGivnCount, DailyGivnCount, DailyOrderCount, GivnSummary, OrdersSummary
from app.services.courier_analytics import refresh_courier_analytics
from app.services.xlsx_export import build_xlsx


router = APIRouter(prefix="/analytics", tags=["analytics"])

METRIC_DELIVERY_WAYBILLS = "delivery_waybills"
METRIC_ACCEPTED_PICKUPS = "accepted_pickups"
METRIC_DELIVERY_BRANCHES = "delivery_branches"
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _empty_daily(stat_date: date) -> DailyOrderCount:
    return DailyOrderCount(date=stat_date, count=0, pickup_count=0, waybill_count=0)


def _city_daily(item: CourierCityDailyStat) -> CityDailyCount:
    return CityDailyCount(
        date=item.stat_date,
        city_code=item.city_code,
        city_name=item.city_name,
        branch_code=item.branch_code,
        branch_name=item.branch_name,
        count=item.total_count,
    )


def _empty_givn_daily(stat_date: date) -> DailyGivnCount:
    return DailyGivnCount(date=stat_date, count=0, quantity=0)


def _delivery_stats_query(db: Session, month_start: date, today: date) -> list[CourierCityDailyStat]:
    return (
        db.query(CourierCityDailyStat)
        .filter(
            CourierCityDailyStat.metric_type == METRIC_DELIVERY_WAYBILLS,
            CourierCityDailyStat.stat_date >= month_start,
            CourierCityDailyStat.stat_date <= today,
        )
        .order_by(
            CourierCityDailyStat.stat_date.asc(),
            CourierCityDailyStat.total_count.desc(),
            CourierCityDailyStat.city_name.asc(),
            CourierCityDailyStat.branch_name.asc(),
        )
        .all()
    )


def _delivery_export_workbook(stats: list[CourierCityDailyStat]) -> bytes:
    totals_by_date: dict[date, dict[str, int]] = {}
    for item in stats:
        bucket = totals_by_date.setdefault(item.stat_date, {"total": 0, "branches": 0})
        bucket["total"] += item.total_count
        bucket["branches"] += 1

    daily_rows: list[list[str | int]] = [["Дата", "Филиалов", "Всего"]]
    daily_rows.extend(
        [stat_date.isoformat(), values["branches"], values["total"]]
        for stat_date, values in sorted(totals_by_date.items())
    )

    detail_rows: list[list[str | int]] = [["Дата", "Город", "Филиал", "Кол-во"]]
    detail_rows.extend(
        [
            item.stat_date.isoformat(),
            item.city_name,
            item.branch_name or "",
            item.total_count,
        ]
        for item in stats
    )

    return build_xlsx(
        [
            ("По дням", daily_rows),
            ("По филиалам", detail_rows),
        ]
    )


@router.get("/orders/summary", response_model=OrdersSummary)
def get_orders_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
) -> OrdersSummary:
    refresh_courier_analytics(db)

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
    givn_stats = (
        db.query(CourierGivnDailyStat)
        .filter(
            CourierGivnDailyStat.stat_date >= month_start,
            CourierGivnDailyStat.stat_date <= today,
        )
        .order_by(CourierGivnDailyStat.stat_date.asc())
        .all()
    )
    givn_stats_by_date = {item.stat_date: item for item in givn_stats}
    today_givn_stat = givn_stats_by_date.get(today)
    givn_month_count, givn_month_quantity = (
        db.query(
            func.coalesce(func.sum(CourierGivnDailyStat.total_count), 0),
            func.coalesce(func.sum(CourierGivnDailyStat.total_quantity), 0),
        )
        .filter(
            CourierGivnDailyStat.stat_date >= month_start,
            CourierGivnDailyStat.stat_date <= today,
        )
        .one()
    )
    top_givn_couriers = (
        db.query(
            CourierGivnCourierDailyStat.courier_code,
            CourierGivnCourierDailyStat.courier_name,
            func.coalesce(func.sum(CourierGivnCourierDailyStat.total_count), 0).label("total_count"),
            func.coalesce(func.sum(CourierGivnCourierDailyStat.total_quantity), 0).label("total_quantity"),
        )
        .filter(
            CourierGivnCourierDailyStat.stat_date >= month_start,
            CourierGivnCourierDailyStat.stat_date <= today,
        )
        .group_by(CourierGivnCourierDailyStat.courier_code, CourierGivnCourierDailyStat.courier_name)
        .order_by(func.sum(CourierGivnCourierDailyStat.total_count).desc(), CourierGivnCourierDailyStat.courier_name.asc())
        .limit(12)
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
        delivery_by_branch=[_city_daily(item) for item in city_stats if item.metric_type == METRIC_DELIVERY_BRANCHES],
        givn=GivnSummary(
            today_count=today_givn_stat.total_count if today_givn_stat else 0,
            today_quantity=today_givn_stat.total_quantity if today_givn_stat else 0,
            month_count=int(givn_month_count or 0),
            month_quantity=int(givn_month_quantity or 0),
            daily=[
                DailyGivnCount(
                    date=item.stat_date,
                    count=item.total_count,
                    quantity=item.total_quantity,
                )
                for item in givn_stats
            ]
            or [_empty_givn_daily(today)],
            top_couriers=[
                CourierGivnCount(
                    courier_code=str(item.courier_code),
                    courier_name=str(item.courier_name),
                    count=int(item.total_count or 0),
                    quantity=int(item.total_quantity or 0),
                )
                for item in top_givn_couriers
            ],
        ),
    )


@router.get("/orders/export")
def export_orders_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_manager_or_admin),
) -> Response:
    refresh_courier_analytics(db)

    today = date.today()
    month_start = today.replace(day=1)
    stats = _delivery_stats_query(db, month_start, today)
    content = _delivery_export_workbook(stats)
    filename = f"courier_delivery_dashboard_{month_start.isoformat()}_{today.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
