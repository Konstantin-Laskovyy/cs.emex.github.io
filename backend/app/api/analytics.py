from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, time, timedelta
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_admin
from app.core.config import settings
from app.models.user import User
from app.schemas.analytics import DailyOrderCount, OrdersSummary

try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
except ImportError:  # pragma: no cover - depends on production installation
    mysql = None  # type: ignore[assignment]
    MySQLError = Exception  # type: ignore[assignment]


router = APIRouter(prefix="/analytics", tags=["analytics"])

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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Courier analytics database is not configured: {', '.join(missing)}",
        )


@contextmanager
def _courier_connection() -> Iterator[object]:
    _require_courier_config()
    if mysql is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="mysql-connector-python is not installed",
        )

    try:
        connection = mysql.connector.connect(
            host=settings.courier_db_host,
            port=settings.courier_db_port,
            user=settings.courier_db_user,
            password=settings.courier_db_password,
            database=settings.courier_db_name,
            connection_timeout=10,
        )
    except MySQLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Courier analytics database is unavailable",
        ) from exc

    try:
        yield connection
    finally:
        connection.close()


def _quote_identifier(value: str) -> str:
    return f"`{value.replace('`', '``')}`"


def _get_address_date_column(cursor: object) -> str:
    try:
        cursor.execute("SHOW COLUMNS FROM address")
        rows = cursor.fetchall()
    except MySQLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not read courier.address schema",
        ) from exc
    columns = {row["Field"] for row in rows if row.get("Field")}

    if settings.courier_address_date_column:
        if settings.courier_address_date_column not in columns:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Column {settings.courier_address_date_column} was not found in courier.address",
            )
        return settings.courier_address_date_column

    for candidate in ADDRESS_DATE_COLUMN_CANDIDATES:
        if candidate in columns:
            return candidate

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Could not detect a date column in courier.address. Set COURIER_ADDRESS_DATE_COLUMN.",
    )


@router.get("/orders/summary", response_model=OrdersSummary)
def get_orders_summary(_: User = Depends(require_admin)) -> OrdersSummary:
    today = date.today()
    month_start = today.replace(day=1)
    today_start = datetime.combine(today, time.min)
    tomorrow_start = today_start + timedelta(days=1)
    month_start_at = datetime.combine(month_start, time.min)

    with _courier_connection() as connection:
        cursor = connection.cursor(dictionary=True)
        try:
            if settings.courier_address_date_column:
                date_expression = f"a.{_quote_identifier(_get_address_date_column(cursor))}"
                from_expression = "address a"
                visible_filter = ""
            else:
                # courier.address stores delivery points, while zakaz owns the order date.
                # This counts address rows but groups them by the linked order date.
                date_expression = "z.date_beg"
                from_expression = "address a JOIN zakaz z ON z.code = a.zakaz"
                visible_filter = "AND z.Visible = 'T'"

            cursor.execute(
                f"""
                SELECT COUNT(*) AS count
                FROM {from_expression}
                WHERE {date_expression} >= %s
                  AND {date_expression} < %s
                  {visible_filter}
                """,
                (today_start, tomorrow_start),
            )
            today_count = int((cursor.fetchone() or {}).get("count") or 0)

            cursor.execute(
                f"""
                SELECT COUNT(*) AS count
                FROM {from_expression}
                WHERE {date_expression} >= %s
                  AND {date_expression} < %s
                  {visible_filter}
                """,
                (month_start_at, tomorrow_start),
            )
            month_count = int((cursor.fetchone() or {}).get("count") or 0)

            cursor.execute(
                f"""
                SELECT DATE({date_expression}) AS order_date, COUNT(*) AS count
                FROM {from_expression}
                WHERE {date_expression} >= %s
                  AND {date_expression} < %s
                  {visible_filter}
                GROUP BY DATE({date_expression})
                ORDER BY DATE({date_expression})
                """,
                (month_start_at, tomorrow_start),
            )
            rows = cursor.fetchall()
        except MySQLError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Courier address analytics query failed",
            ) from exc
        finally:
            cursor.close()

    return OrdersSummary(
        today=today,
        month_start=month_start,
        today_count=today_count,
        month_count=month_count,
        daily=[
            DailyOrderCount(date=row["order_date"], count=int(row["count"] or 0))
            for row in rows
            if row.get("order_date")
        ],
    )
