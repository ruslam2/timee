from decimal import Decimal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "MagazinAPI"
    environment: str = "dev"  # dev | prod

    database_url: str = "postgresql+asyncpg://magazin:magazin@db:5432/magazin"
    redis_url: str = "redis://redis:6379/0"

    jwt_secret: str = "dev-only-secret-change-me-in-production-0000"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 30

    # console: код пишется в лог и возвращается в ответе (только для разработки)
    sms_provider: str = "console"
    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5

    # телефоны, которые при первом входе получают права администратора платформы
    admin_phones: list[str] = []

    platform_commission_percent: Decimal = Decimal("5")
    cny_markup_percent: Decimal = Decimal("2")
    cbu_rates_url: str = "https://cbu.uz/ru/arkhiv-kursov-valyut/json/CNY/"

    # платёжная заглушка для разработки; Payme и Click подключаются отдельно
    mock_payments_enabled: bool = True

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]

    @property
    def is_dev(self) -> bool:
        return self.environment == "dev"


settings = Settings()
