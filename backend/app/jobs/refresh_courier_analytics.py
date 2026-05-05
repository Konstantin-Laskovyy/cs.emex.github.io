from app.db.session import SessionLocal
from app.services.courier_analytics import refresh_courier_daily_address_stats


def main() -> None:
    with SessionLocal() as db:
        refreshed = refresh_courier_daily_address_stats(db)
    print(f"Refreshed courier address stats for {refreshed} day(s).")


if __name__ == "__main__":
    main()
