from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, time, timedelta
from typing import Iterator

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.courier_analytics import (
    CourierCityDailyStat,
    CourierDailyAddressStat,
    CourierGivnCourierDailyStat,
    CourierGivnDailyStat,
)

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

METRIC_DELIVERY_WAYBILLS = "delivery_waybills"
METRIC_ACCEPTED_PICKUPS = "accepted_pickups"
METRIC_DELIVERY_BRANCHES = "delivery_branches"
COURIER_ANALYTICS_REFRESH_LOCK_ID = 2026071501

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

TOWN_CODE_COLUMN_CANDIDATES = ("Code", "code", "ID", "id")
TOWN_NAME_COLUMN_CANDIDATES = ("Name", "name", "TownName", "town", "City", "city", "Naim", "naim")


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


def _get_town_columns(cursor: object) -> tuple[str | None, str | None]:
    try:
        cursor.execute("SHOW COLUMNS FROM town")
        rows = cursor.fetchall()
    except MySQLError:
        return None, None

    columns = {row["Field"] for row in rows if row.get("Field")}
    code_column = next((candidate for candidate in TOWN_CODE_COLUMN_CANDIDATES if candidate in columns), None)
    name_column = next((candidate for candidate in TOWN_NAME_COLUMN_CANDIDATES if candidate in columns), None)
    return code_column, name_column


def _city_select(cursor: object, address_column: str, alias: str) -> tuple[str, str]:
    code_column, name_column = _get_town_columns(cursor)
    address_city_code = f"COALESCE(NULLIF(TRIM(CAST(a.{address_column} AS CHAR)), ''), 'unknown')"

    if not code_column:
        return (
            f"{address_city_code} AS city_code, CONCAT('Город ', {address_city_code}) AS city_name",
            "",
        )

    quoted_code = _quote_identifier(code_column)
    quoted_name = _quote_identifier(name_column) if name_column else quoted_code
    city_code = f"COALESCE(NULLIF(TRIM(CAST({alias}.{quoted_code} AS CHAR)), ''), {address_city_code})"
    city_name = f"COALESCE(NULLIF(TRIM(CAST({alias}.{quoted_name} AS CHAR)), ''), CONCAT('Город ', {address_city_code}))"
    join_clause = f"LEFT JOIN town {alias} ON {alias}.{quoted_code} = a.{address_column}"
    return f"{city_code} AS city_code, {city_name} AS city_name", join_clause


def _branch_select(address_column: str, alias: str) -> tuple[str, str]:
    address_branch_code = f"COALESCE(NULLIF(TRIM(CAST(a.{address_column} AS CHAR)), ''), 'unknown')"
    branch_code = f"COALESCE(NULLIF(TRIM(CAST({alias}.Code AS CHAR)), ''), {address_branch_code})"
    branch_name = f"COALESCE(NULLIF(TRIM(CAST({alias}.Name AS CHAR)), ''), CONCAT('Филиал ', {address_branch_code}))"
    join_clause = f"LEFT JOIN store {alias} ON {alias}.Code = a.{address_column}"
    return f"{branch_code} AS city_code, {branch_name} AS city_name", join_clause


def _delivery_city_with_responsible_branch_select(address_column: str, town_alias: str, branch_alias: str) -> str:
    address_city_code = f"COALESCE(NULLIF(TRIM(CAST(a.{address_column} AS CHAR)), ''), 'unknown')"
    city_code = f"CASE WHEN {branch_alias}.Code IS NULL THEN 'other' ELSE COALESCE(NULLIF(TRIM(CAST({town_alias}.Code AS CHAR)), ''), {address_city_code}) END"
    city_name = f"CASE WHEN {branch_alias}.Code IS NULL THEN 'Другие города' ELSE COALESCE(NULLIF(TRIM(CAST({town_alias}.Name AS CHAR)), ''), CONCAT('Город ', {address_city_code})) END"
    branch_code = f"CASE WHEN {branch_alias}.Code IS NULL THEN 'other' ELSE NULLIF(TRIM(CAST({branch_alias}.Code AS CHAR)), '') END"
    branch_name = f"CASE WHEN {branch_alias}.Code IS NULL THEN 'Другие города' ELSE NULLIF(TRIM(CAST({branch_alias}.Name AS CHAR)), '') END"
    return (
        f"{city_code} AS city_code, {city_name} AS city_name, "
        f"{branch_code} AS branch_code, {branch_name} AS branch_name"
    )


def _responsible_branch_join(address_column: str, alias: str) -> str:
    join_clause = f"""
                LEFT JOIN (
                  SELECT candidate.Town, MIN(candidate.Code) AS Code
                  FROM store candidate
                  WHERE candidate.Active = 'T'
                    AND candidate.Our = 'T'
                    AND candidate.parent = 0
                    AND candidate.Name LIKE 'EMEX%'
                  GROUP BY candidate.Town
                ) {alias}_pick ON {alias}_pick.Town = a.{address_column}
                LEFT JOIN store {alias} ON {alias}.Code = {alias}_pick.Code"""
    return join_clause


def _courier_store_delivery_select() -> str:
    branch_code = "COALESCE(NULLIF(TRIM(CAST(s.Code AS CHAR)), ''), NULLIF(TRIM(CAST(k.store AS CHAR)), ''), 'other')"
    city_code = branch_code
    city_name = "COALESCE(NULLIF(TRIM(CAST(st.Name AS CHAR)), ''), 'Другие города')"
    branch_name = "COALESCE(NULLIF(TRIM(CAST(s.Name AS CHAR)), ''), CONCAT('Филиал ', COALESCE(NULLIF(TRIM(CAST(k.store AS CHAR)), ''), '0')))"
    return (
        f"{city_code} AS city_code, {city_name} AS city_name, "
        f"{branch_code} AS branch_code, {branch_name} AS branch_name"
    )


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


def fetch_current_month_city_stats(today: date | None = None) -> list[dict]:
    today = today or date.today()
    month_start = today.replace(day=1)
    month_start_at = datetime.combine(month_start, time.min)
    tomorrow_start = datetime.combine(today, time.min) + timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    with _courier_connection() as connection:
        cursor = connection.cursor(dictionary=True)
        try:
            date_expression, from_expression, visible_filter = _get_address_source(cursor)
            delivery_city_select = _courier_store_delivery_select()
            accepted_city_select, accepted_town_join = _city_select(cursor, "TownFrom", "tf")
            delivery_branch_select, delivery_branch_join = _branch_select("FL", "sf")
            barcode_expression = "COALESCE(NULLIF(TRIM(CAST(a.strbarcode AS CHAR)), ''), '0')"
            cursor.execute(
                f"""
                SELECT %s AS metric_type, g.date_beg AS stat_date, {delivery_city_select}, COUNT(*) AS count
                FROM givn g
                LEFT JOIN kurier k ON k.code = g.kurier
                LEFT JOIN store s ON s.Code = k.store
                LEFT JOIN town st ON st.Code = s.Town
                WHERE g.date_beg >= %s
                  AND g.date_beg < %s
                GROUP BY g.date_beg, city_code, city_name, branch_code, branch_name

                UNION ALL

                SELECT %s AS metric_type, DATE({date_expression}) AS stat_date, {accepted_city_select}, NULL AS branch_code, NULL AS branch_name, COUNT(*) AS count
                FROM {from_expression}
                {accepted_town_join}
                WHERE {date_expression} >= %s
                  AND {date_expression} < %s
                  {visible_filter}
                  AND {barcode_expression} = '0'
                GROUP BY DATE({date_expression}), city_code, city_name

                UNION ALL

                SELECT %s AS metric_type, DATE({date_expression}) AS stat_date, {delivery_branch_select}, NULL AS branch_code, NULL AS branch_name, COUNT(*) AS count
                FROM {from_expression}
                {delivery_branch_join}
                WHERE {date_expression} >= %s
                  AND {date_expression} < %s
                  {visible_filter}
                  AND {barcode_expression} <> '0'
                GROUP BY DATE({date_expression}), city_code, city_name

                ORDER BY stat_date, metric_type, count DESC
                """,
                (
                    METRIC_DELIVERY_WAYBILLS,
                    month_start,
                    tomorrow,
                    METRIC_ACCEPTED_PICKUPS,
                    month_start_at,
                    tomorrow_start,
                    METRIC_DELIVERY_BRANCHES,
                    month_start_at,
                    tomorrow_start,
                ),
            )
            return list(cursor.fetchall())
        except MySQLError as exc:
            raise RuntimeError("Courier city analytics query failed") from exc
        finally:
            cursor.close()


def fetch_current_month_givn_daily_stats(today: date | None = None) -> list[dict]:
    today = today or date.today()
    month_start = today.replace(day=1)
    tomorrow = today + timedelta(days=1)
    date_expression = "g.date_beg"

    with _courier_connection() as connection:
        cursor = connection.cursor(dictionary=True)
        try:
            cursor.execute(
                f"""
                SELECT
                  {date_expression} AS stat_date,
                  COUNT(*) AS count,
                  SUM(COALESCE(g.Kol_vo, 0)) AS quantity
                FROM givn g
                WHERE g.date_beg >= %s
                  AND g.date_beg < %s
                GROUP BY {date_expression}
                ORDER BY {date_expression}
                """,
                (month_start, tomorrow),
            )
            return list(cursor.fetchall())
        except MySQLError as exc:
            raise RuntimeError("Courier givn daily analytics query failed") from exc
        finally:
            cursor.close()


def fetch_current_month_givn_courier_stats(today: date | None = None) -> list[dict]:
    today = today or date.today()
    month_start = today.replace(day=1)
    tomorrow = today + timedelta(days=1)
    date_expression = "g.date_beg"
    courier_code = "COALESCE(NULLIF(TRIM(CAST(g.kurier AS CHAR)), ''), 'unknown')"
    courier_name = f"COALESCE(NULLIF(TRIM(CAST(MAX(k.name) AS CHAR)), ''), CONCAT('Courier ', {courier_code}))"

    with _courier_connection() as connection:
        cursor = connection.cursor(dictionary=True)
        try:
            cursor.execute(
                f"""
                SELECT
                  {date_expression} AS stat_date,
                  {courier_code} AS courier_code,
                  {courier_name} AS courier_name,
                  COUNT(*) AS count,
                  SUM(COALESCE(g.Kol_vo, 0)) AS quantity
                FROM givn g
                LEFT JOIN kurier k ON k.code = g.kurier
                WHERE g.date_beg >= %s
                  AND g.date_beg < %s
                GROUP BY {date_expression}, courier_code
                ORDER BY {date_expression}, count DESC
                """,
                (month_start, tomorrow),
            )
            return list(cursor.fetchall())
        except MySQLError as exc:
            raise RuntimeError("Courier givn courier analytics query failed") from exc
        finally:
            cursor.close()


def refresh_courier_daily_address_stats(db: Session, today: date | None = None) -> int:
    rows = fetch_current_month_address_stats(today=today)
    city_rows = fetch_current_month_city_stats(today=today)
    refreshed = 0
    today = today or date.today()
    month_start = today.replace(day=1)

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

    db.query(CourierCityDailyStat).filter(
        CourierCityDailyStat.stat_date >= month_start,
        CourierCityDailyStat.stat_date <= today,
    ).delete(synchronize_session=False)

    for row in city_rows:
        stat_date = row.get("stat_date")
        metric_type = row.get("metric_type")
        city_code = row.get("city_code")
        if not stat_date or not metric_type or not city_code:
            continue

        db.add(
            CourierCityDailyStat(
                metric_type=str(metric_type),
                stat_date=stat_date,
                city_code=str(city_code),
                city_name=str(row.get("city_name") or city_code),
                branch_code=str(row["branch_code"]) if row.get("branch_code") else None,
                branch_name=str(row["branch_name"]) if row.get("branch_name") else None,
                total_count=int(row.get("count") or 0),
            )
        )
        refreshed += 1

    db.commit()
    return refreshed


def refresh_courier_givn_stats(db: Session, today: date | None = None) -> int:
    rows = fetch_current_month_givn_daily_stats(today=today)
    courier_rows = fetch_current_month_givn_courier_stats(today=today)
    refreshed = 0
    today = today or date.today()
    month_start = today.replace(day=1)

    for row in rows:
        stat_date = row.get("stat_date")
        if not stat_date:
            continue

        stat = db.get(CourierGivnDailyStat, stat_date)
        if stat is None:
            stat = CourierGivnDailyStat(stat_date=stat_date)

        stat.total_count = int(row.get("count") or 0)
        stat.total_quantity = int(row.get("quantity") or 0)
        db.add(stat)
        refreshed += 1

    db.query(CourierGivnCourierDailyStat).filter(
        CourierGivnCourierDailyStat.stat_date >= month_start,
        CourierGivnCourierDailyStat.stat_date <= today,
    ).delete(synchronize_session=False)

    for row in courier_rows:
        stat_date = row.get("stat_date")
        courier_code = row.get("courier_code")
        if not stat_date or not courier_code:
            continue

        db.add(
            CourierGivnCourierDailyStat(
                stat_date=stat_date,
                courier_code=str(courier_code),
                courier_name=str(row.get("courier_name") or courier_code),
                total_count=int(row.get("count") or 0),
                total_quantity=int(row.get("quantity") or 0),
            )
        )
        refreshed += 1

    db.commit()
    return refreshed


def refresh_courier_analytics(db: Session, today: date | None = None) -> int:
    lock_acquired = bool(
        db.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)"),
            {"lock_id": COURIER_ANALYTICS_REFRESH_LOCK_ID},
        ).scalar()
    )
    if not lock_acquired:
        return 0

    try:
        return refresh_courier_daily_address_stats(db, today=today) + refresh_courier_givn_stats(db, today=today)
    except Exception:
        db.rollback()
        raise
    finally:
        db.execute(
            text("SELECT pg_advisory_unlock(:lock_id)"),
            {"lock_id": COURIER_ANALYTICS_REFRESH_LOCK_ID},
        )
