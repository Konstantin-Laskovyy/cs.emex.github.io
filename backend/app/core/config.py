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
    ad_enabled: bool = False
    ad_server: str = ""
    ad_domain: str = ""
    ad_base_dn: str = ""
    ad_use_ssl: bool = False
    ad_bind_dn: str = ""
    ad_bind_password: str = ""
    ad_default_email_domain: str = "emex.kz"


settings = Settings()

