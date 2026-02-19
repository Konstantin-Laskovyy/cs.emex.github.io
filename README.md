# Intranet Social (MVP)

MVP внутренней «социальной сети» компании: главная, сотрудники, отделы, карточка сотрудника, вход по email/паролю.

## Структура
- `frontend/`: React SPA (Vite + TypeScript)
- `backend/`: FastAPI + SQLAlchemy + Alembic + JWT
- `docker-compose.yml`: PostgreSQL для разработки

## Быстрый старт (dev)

### 1) База данных (PostgreSQL)

Запустите БД:

```bash
docker compose up -d db
```

### 2) Backend (FastAPI)

Перейдите в `backend/`, создайте окружение и установите зависимости:

```bash
py -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Примените миграции:

```bash
.venv\Scripts\alembic upgrade head
```

Засейдите демо-данные (опционально):

```bash
.venv\Scripts\python -m app.seed
```

Запустите API:

```bash
.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

API будет доступно на `http://localhost:8000`, health-check: `GET /health`.

### 3) Frontend (React)

Нужен установленный Node.js (рекомендуется LTS).

```bash
cd frontend
npm install
npm run dev
```

По умолчанию фронт ходит в API по `http://localhost:8000`.
Чтобы изменить URL бэкенда, задайте переменную окружения:

```bash
VITE_API_URL=http://localhost:8000
```

## Демо-логин

После `python -m app.seed` можно входить:
- **email**: `ivan.petrov@company.local`
- **password**: `Password123!`

## Деплой
- **Frontend**: можно деплоить на GitHub Pages (статическая сборка `frontend/dist`).
- **Backend + DB**: отдельный хостинг/сервер (например, Docker/VM/облако). В проде обязательно смените `jwt_secret` и включите HTTPS.