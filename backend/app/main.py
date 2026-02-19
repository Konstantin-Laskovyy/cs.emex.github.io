from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.departments import router as departments_router
from app.api.me import router as me_router
from app.api.users import router as users_router


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(departments_router)
    app.include_router(me_router)
    app.include_router(users_router)

    @app.on_event("startup")
    def _startup_seed() -> None:
        if not settings.auto_seed:
            return
        from app.db.session import SessionLocal
        from app.seed import seed

        with SessionLocal() as db:
            seed(db)

    return app


app = create_app()

