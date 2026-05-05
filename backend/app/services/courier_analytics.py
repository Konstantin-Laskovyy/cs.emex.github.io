from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, time, timedelta
from typing import Iterator

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.courier_analytics import CourierDailyAddressStat

try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
except ImportError:  # pragma: no cover - depends on production installation
    mysql = None  # type: ignore[assignment]
    MySQLError = Exception  # type: ignore[assignment]


ADDRESS_KIND_SELECT = """
COUNT(*) AS count,
SUM(CASE WHEN COALESCE(NULLIF(TRIM(CAST(a.strbarcode AS CHAR)), ''), '0') = '0' THEN 1 ELSE 0 END) AS pickup_count,
SUM(CASE WHEN COALESCE(NULLIF(TRIM(CAST(a.strbarcode AS CHAR)), ''), '0') <> '0' THEN 1 ELSE 0 END) AS waybill_count
"""

ADDRESS_DATE_COLUMN_CANDIDATES = (
    "date_beg",
    "DateBeg",
    "date",
    "Date",
    "created_at",
    "created",
    "CreateDate",
    "DateCreate",
    "time",
    "Time",
)


def _require_courier_config() -> None:
    missing = [
        name
        for name, value in {
            "COURIER_DB_HOST": settings.courier_db_host,
            "COURIER_DB_USER": settings.courier_db_user,
            "COURIER_DB_PASSWORD": settings.courier_db_password,
            "COURIER_DB_NAME": settings.courier_db_name,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Courier analytics database is not configured: {', '.join(missing)}")


@contextmanager
def _courier_connection() -> Iterator[object]:
    _require_courier_config()
    if mysql is None:
        raise RuntimeError("mysql-connector-python is not installed")

    connection = mysql.connector.connect(
        host=settings.courier_db_host,
        port=settings.courier_db_port,
        user=settings.courier_db_user,
        password=settings.courier_db_password,
        database=settings.courier_db_name,
        connection_timeout=10,
    )

    try:
        yield connection
    finally:
        connection.close()


def _quote_identifier(value: str) -> str:
    return f"`{value.replace('`', '``')}`"


def _get_address_date_column(cursor: object) -> str:
    cursor.execute("SHOW COLUMNS FROM address")
    rows = cursor.fetchall()
    columns = {row["Field"] for row in rows if row.get("Field")}

    if settings.courier_address_date_column:
        if settings.courier_address_date_column not in columns:
            raise RuntimeError(f"Column {settings.courier_address_date_column} was not found in courier.address")
        return settings.courier_address_date_column

    for candidate in ADDRESS_DATE_COLUMN_CANDIDATES:
        if candidate in columns:
            return candidate

    raise RuntimeError("Could not detect a date column in courier.address")


def _get_address_source(cursor: object) -> tuple[str, str, str]:
    if settings.courier_address_date_column:
        return f"a.{_quote_identifier(_get_address_date_column(cursor))}", "address a", ""

    # courier.address stores delivery points, while zakaz owns the order date.
    # This counts address rows but groups them by the linked order date.
    return "z.date_beg", "address a JOIN zakaz z ON z.code = a.zakaz", "AND z.Visible = 'T'"


def fetch_current_month_address_stats(today: date | None = None) -> list[dict]:
    today = today or date.today()
    month_start = today.replace(day=1)
    month_start_at = datetime.combine(month_start, time.min)
    tomorrow_start = datetime.combine(today, time.min) + timedelta(days=1)

    with _courier_connection() as connection:
        cursor = connection.cursor(dictionary=True)
        try:
            date_expression, from_expression, visible_filter = _get_address_source(cursor)
            cursor.execute(
                f"""
                SELECT DATE({date_expression}) AS stat_date, {ADDRESS_KIND_SELECT}
                FROM {from_expression}
                WHERE {date_expression} >= %s
                  AND {date_expression} < %s
                  {visible_filter}
                GROUP BY DATE({date_expression})
                ORDER BY DATE({date_expression})
                """,
                (month_start_at, tomorrow_start),
            )
            return list(cursor.fetchall())
        except MySQLError as exc:
            raise RuntimeError("Courier address analytics query failed") from exc
        finally:
            cursor.close()


def refresh_courier_daily_address_stats(db: Session, today: date | None = None) -> int:
    rows = fetch_current_month_address_stats(today=today)
    refreshed = 0

    for row in rows:
        stat_date = row.get("stat_date")
        if not stat_date:
            continue

        stat = db.get(CourierDailyAddressStat, stat_date)
        if stat is None:
            stat = CourierDailyAddressStat(stat_date=stat_date)

        stat.total_count = int(row.get("count") or 0)
        stat.pickup_count = int(row.get("pickup_count") or 0)
        stat.waybill_count = int(row.get("waybill_count") or 0)
        db.add(stat)
        refreshed += 1

    db.commit()
    return refreshed
