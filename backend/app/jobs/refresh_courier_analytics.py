from app.db.session import SessionLocal
from app.services.courier_analytics import refresh_courier_analytics


def main() -> None:
    with SessionLocal() as db:
        refreshed = refresh_courier_analytics(db)
    print(f"Refreshed courier analytics for {refreshed} row(s).")


if __name__ == "__main__":
    main()
