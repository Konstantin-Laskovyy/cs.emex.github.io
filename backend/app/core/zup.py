from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from app.core.config import settings


@dataclass(frozen=True)
class ZupEmployeeSummary:
    employment_started_on: date
    vacation_days_used: Decimal | None
    vacation_days_remaining: Decimal | None
    last_vacation_info: str | None
    source_updated_at: datetime

    @property
    def vacation_days_total(self) -> Decimal | None:
        if self.vacation_days_used is None or self.vacation_days_remaining is None:
            return None
        return self.vacation_days_used + self.vacation_days_remaining


class ZupConfigurationError(RuntimeError):
    pass


class ZupServiceError(RuntimeError):
    pass


def fetch_employee_summary(iin: str) -> ZupEmployeeSummary:
    cleaned_iin = iin.strip()
    if not cleaned_iin:
        raise ZupServiceError("Employee IIN is empty")
    if not settings.zup_wsdl_url or not settings.zup_username or not settings.zup_password:
        raise ZupConfigurationError("1C ZUP SOAP settings are not configured")

    try:
        from requests import Session
        from requests.auth import HTTPBasicAuth
        from zeep import Client
        from zeep.exceptions import Error as ZeepError
        from zeep.transports import Transport
    except ImportError as exc:
        raise ZupConfigurationError("Python SOAP dependencies are not installed") from exc

    session = Session()
    session.auth = HTTPBasicAuth(settings.zup_username, settings.zup_password)
    transport = Transport(session=session, timeout=settings.zup_timeout_seconds)

    try:
        client = Client(settings.zup_wsdl_url, transport=transport)
        service_url = settings.zup_service_url or settings.zup_wsdl_url.split("?", 1)[0]
        service = client.create_service("{AST_Emex}AST_EmexSoapBinding", service_url)
        employment_started_on = _parse_date(service.DataPriema(cleaned_iin), "DataPriema")
        vacation_days_remaining = _parse_decimal(service.OstatokOtpuska(cleaned_iin))
        vacation_days_used = _parse_decimal(service.IspolzovanoOtpusknixDneiZaTekushiGod(cleaned_iin))
        last_vacation_info = _clean_optional(service.InformaciyaPoPoslednemuOtpusku(cleaned_iin))
    except ZeepError as exc:
        raise ZupServiceError(f"1C ZUP SOAP error: {exc}") from exc
    except Exception as exc:
        raise ZupServiceError(f"Could not fetch 1C ZUP data: {exc}") from exc

    return ZupEmployeeSummary(
        employment_started_on=employment_started_on,
        vacation_days_used=vacation_days_used,
        vacation_days_remaining=vacation_days_remaining,
        last_vacation_info=last_vacation_info,
        source_updated_at=datetime.utcnow(),
    )


def decimal_to_days(value: Decimal | None) -> int | None:
    if value is None:
        return None
    return max(0, int(value.to_integral_value()))


def _parse_date(value: Any, field_name: str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%Y%m%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    raise ZupServiceError(f"1C ZUP returned invalid date for {field_name}: {text}")


def _parse_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", ".")
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ZupServiceError(f"1C ZUP returned invalid numeric value: {text}") from exc


def _clean_optional(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None
