from datetime import date

from pydantic import BaseModel


class DailyOrderCount(BaseModel):
    date: date
    count: int


class OrdersSummary(BaseModel):
    today: date
    month_start: date
    today_count: int
    month_count: int
    daily: list[DailyOrderCount]
