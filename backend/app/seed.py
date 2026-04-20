from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.department import Department
from app.models.user import User


def seed(db: Session) -> None:
    if db.query(User).first() is not None:
        return

    departments = [
        Department(name="Разработка"),
        Department(name="Продукт"),
        Department(name="HR"),
        Department(name="Финансы"),
        Department(name="Маркетинг"),
        Department(name="Поддержка"),
    ]
    db.add_all(departments)
    db.flush()

    department_by_name = {department.name: department for department in departments}
    default_password = "Password123!"

    users = [
        User(
            email="ivan.petrov@company.local",
            password_hash=hash_password(default_password),
            first_name="Иван",
            last_name="Петров",
            title="Head of Engineering",
            department_id=department_by_name["Разработка"].id,
            location="Москва",
            phone="+7 (999) 000-00-01",
            avatar_url="https://i.pravatar.cc/300?img=12",
            bio="Отвечаю за инженерную команду, архитектуру платформы и развитие внутренних сервисов.",
        ),
        User(
            email="maria.sokolova@company.local",
            password_hash=hash_password(default_password),
            first_name="Мария",
            last_name="Соколова",
            title="HR Lead",
            department_id=department_by_name["HR"].id,
            location="Санкт-Петербург",
            phone="+7 (999) 000-00-02",
            avatar_url="https://i.pravatar.cc/300?img=32",
            bio="Развиваю команду, онбординг и внутренние карьерные треки сотрудников.",
        ),
        User(
            email="alexey.smirnov@company.local",
            password_hash=hash_password(default_password),
            first_name="Алексей",
            last_name="Смирнов",
            title="Product Director",
            department_id=department_by_name["Продукт"].id,
            location="Удаленно",
            phone="+7 (999) 000-00-03",
            avatar_url="https://i.pravatar.cc/300?img=14",
            bio="Формирую продуктовую стратегию, roadmap и приоритеты развития сервиса.",
        ),
        User(
            email="elena.kozlova@company.local",
            password_hash=hash_password(default_password),
            first_name="Елена",
            last_name="Козлова",
            title="Finance Manager",
            department_id=department_by_name["Финансы"].id,
            location="Москва",
            phone="+7 (999) 000-00-04",
            avatar_url="https://i.pravatar.cc/300?img=47",
            bio="Веду финансовое планирование, бюджеты и контроль затрат по проектам.",
        ),
        User(
            email="nikita.ivanov@company.local",
            password_hash=hash_password(default_password),
            first_name="Никита",
            last_name="Иванов",
            title="Frontend Engineer",
            department_id=department_by_name["Разработка"].id,
            location="Казань",
            phone="+7 (999) 000-00-05",
            avatar_url="https://i.pravatar.cc/300?img=15",
            bio="Разрабатываю пользовательские интерфейсы, дизайн-систему и SPA-модули.",
        ),
        User(
            email="olga.lebedeva@company.local",
            password_hash=hash_password(default_password),
            first_name="Ольга",
            last_name="Лебедева",
            title="Backend Engineer",
            department_id=department_by_name["Разработка"].id,
            location="Новосибирск",
            phone="+7 (999) 000-00-06",
            avatar_url="https://i.pravatar.cc/300?img=21",
            bio="Отвечаю за API, интеграции и надежность сервисов.",
        ),
        User(
            email="pavel.orlov@company.local",
            password_hash=hash_password(default_password),
            first_name="Павел",
            last_name="Орлов",
            title="Product Designer",
            department_id=department_by_name["Продукт"].id,
            location="Екатеринбург",
            phone="+7 (999) 000-00-07",
            avatar_url="https://i.pravatar.cc/300?img=53",
            bio="Проектирую сценарии, интерфейсы и визуальный язык внутренних продуктов.",
        ),
        User(
            email="svetlana.popova@company.local",
            password_hash=hash_password(default_password),
            first_name="Светлана",
            last_name="Попова",
            title="Recruiter",
            department_id=department_by_name["HR"].id,
            location="Самара",
            phone="+7 (999) 000-00-08",
            avatar_url="https://i.pravatar.cc/300?img=28",
            bio="Веду поиск, подбор и коммуникацию с кандидатами.",
        ),
        User(
            email="denis.fedorov@company.local",
            password_hash=hash_password(default_password),
            first_name="Денис",
            last_name="Федоров",
            title="Support Lead",
            department_id=department_by_name["Поддержка"].id,
            location="Удаленно",
            phone="+7 (999) 000-00-09",
            avatar_url="https://i.pravatar.cc/300?img=18",
            bio="Организую работу поддержки, SLA и обратную связь от сотрудников.",
        ),
        User(
            email="irina.volkova@company.local",
            password_hash=hash_password(default_password),
            first_name="Ирина",
            last_name="Волкова",
            title="Marketing Manager",
            department_id=department_by_name["Маркетинг"].id,
            location="Алматы",
            phone="+7 (999) 000-00-10",
            avatar_url="https://i.pravatar.cc/300?img=41",
            bio="Веду внутренние коммуникации, бренд работодателя и корпоративные инициативы.",
        ),
    ]

    db.add_all(users)
    db.flush()

    user_by_email = {user.email: user for user in users}
    user_by_email["nikita.ivanov@company.local"].manager_id = user_by_email["ivan.petrov@company.local"].id
    user_by_email["olga.lebedeva@company.local"].manager_id = user_by_email["ivan.petrov@company.local"].id
    user_by_email["pavel.orlov@company.local"].manager_id = user_by_email["alexey.smirnov@company.local"].id
    user_by_email["svetlana.popova@company.local"].manager_id = user_by_email["maria.sokolova@company.local"].id

    db.commit()


def main() -> None:
    from app.db.session import SessionLocal

    with SessionLocal() as db:
        seed(db)
        print("Seed complete.")


if __name__ == "__main__":
    main()
