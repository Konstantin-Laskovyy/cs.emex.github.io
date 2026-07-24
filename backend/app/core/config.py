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
    upload_dir: str = "uploads"
    public_upload_url: str = "/uploads"
    news_upload_max_bytes: int = 20 * 1024 * 1024
    zup_wsdl_url: str = ""
    zup_service_url: str = ""
    zup_username: str = ""
    zup_password: str = ""
    zup_timeout_seconds: int = 20
    courier_db_host: str = ""
    courier_db_port: int = 3306
    courier_db_user: str = ""
    courier_db_password: str = ""
    courier_db_name: str = "courier"
    courier_address_date_column: str = ""
    courier_analytics_refresh_seconds: int = 3600


settings = Settings()

