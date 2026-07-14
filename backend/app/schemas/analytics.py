from datetime import date

from pydantic import BaseModel


class DailyOrderCount(BaseModel):
    date: date
    count: int
    pickup_count: int
    waybill_count: int


class CityDailyCount(BaseModel):
    date: date
    city_code: str
    city_name: str
    count: int


class DailyGivnCount(BaseModel):
    date: date
    count: int
    quantity: int


class CourierGivnCount(BaseModel):
    courier_code: str
    courier_name: str
    count: int
    quantity: int


class GivnSummary(BaseModel):
    today_count: int
    today_quantity: int
    month_count: int
    month_quantity: int
    daily: list[DailyGivnCount]
    top_couriers: list[CourierGivnCount]


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
    delivery_by_city: list[CityDailyCount]
    accepted_by_city: list[CityDailyCount]
    delivery_by_branch: list[CityDailyCount]
    givn: GivnSummary
