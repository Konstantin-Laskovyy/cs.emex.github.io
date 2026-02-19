from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True)

    app_name: str = "Intranet Social API"
    cors_origins: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/intranet_social"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60
    auto_seed: bool = False


settings = Settings()

