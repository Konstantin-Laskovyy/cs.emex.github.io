from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.department import Department
from app.models.user import User


def seed(db: Session) -> None:
    if db.query(User).first() is not None:
        return

    deps = [
        Department(name="Разработка"),
        Department(name="Продукт"),
        Department(name="HR"),
        Department(name="Финансы"),
    ]
    db.add_all(deps)
    db.flush()

    dep_by_name = {d.name: d for d in deps}
    default_password = "Password123!"

    users = [
        User(
            email="ivan.petrov@company.local",
            password_hash=hash_password(default_password),
            first_name="Иван",
            last_name="Петров",
            title="Backend Engineer",
            department_id=dep_by_name["Разработка"].id,
            location="Москва",
            phone="+7 (999) 000-00-01",
            bio="Люблю чистую архитектуру, PostgreSQL и быстрые API.",
        ),
        User(
            email="maria.sokolova@company.local",
            password_hash=hash_password(default_password),
            first_name="Мария",
            last_name="Соколова",
            title="HR Manager",
            department_id=dep_by_name["HR"].id,
            location="Санкт‑Петербург",
            phone="+7 (999) 000-00-02",
            bio="Помогаю людям и командам расти.",
        ),
        User(
            email="alexey.smirnov@company.local",
            password_hash=hash_password(default_password),
            first_name="Алексей",
            last_name="Смирнов",
            title="Product Manager",
            department_id=dep_by_name["Продукт"].id,
            location="Удалённо",
            phone="+7 (999) 000-00-03",
            bio="Собираю требования и превращаю их в понятные задачи.",
        ),
    ]

    db.add_all(users)
    db.commit()


def main() -> None:
    from app.db.session import SessionLocal

    with SessionLocal() as db:
        seed(db)
        print("Seed complete.")


if __name__ == "__main__":
    main()

