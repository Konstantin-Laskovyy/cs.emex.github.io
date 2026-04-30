from datetime import date

from pydantic import BaseModel


class DailyOrderCount(BaseModel):
    date: date
    count: int
    pickup_count: int
    waybill_count: int


class OrdersSummary(BaseModel):
    today: date
    month_start: date
    today_count: int
    month_count: int
    today_pickup_count: int
    today_waybill_count: int
    month_pickup_count: int
    month_waybill_count: int
    daily: list[DailyOrderCount]
