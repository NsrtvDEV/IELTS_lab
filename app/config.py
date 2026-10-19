from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str
    DEBUG: bool
    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # запас после конца секции на задержки сети, секунды
    SECTION_GRACE_SECONDS: int = 30

    MEDIA_ROOT: str = "media"
    MAX_AUDIO_SIZE_MB: int = 20  # ответы Speaking
    MAX_LISTENING_AUDIO_MB: int = 50  # записи Listening

    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    # ── безопасность (списки в .env — JSON: CORS_ORIGINS=["https://bandup.uz"]) ──
    # сайты, с которых браузеру можно обращаться к API (адрес фронтенда)
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # IP прокси (nginx), которому верим в X-Forwarded-For: без этого за nginx у всех один IP
    # и лимиты на вход считаются общими на всех пользователей
    TRUSTED_PROXIES: list[str] = []
    # Django-админка: свой ключ (не тот, что подписывает JWT), домены и адреса для CSRF
    ADMIN_SECRET_KEY: str = ""
    ADMIN_HOSTS: list[str] = ["localhost", "127.0.0.1"]
    ADMIN_CSRF_ORIGINS: list[str] = []
    ADMIN_LOGIN_ATTEMPTS: int = 10  # неудачных входов в админку с одного IP за 15 минут

    # ── письма (сброс пароля) ──
    FRONTEND_URL: str = "http://localhost:5173"  # из него строится ссылка в письме
    PASSWORD_RESET_EXPIRE_MINUTES: int = 60
    # SMTP почтового сервиса; без SMTP_HOST письма только пишутся в лог (для разработки)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "BandUp <no-reply@localhost>"
    SMTP_SSL: bool = False  # True — порт 465 (SSL сразу); False — 587 со STARTTLS

    model_config = SettingsConfigDict(env_file=".env")

    @model_validator(mode="after")
    def production_is_safe(self):
        """Без DEBUG (на сервере) не запускаемся с небезопасными настройками."""
        if self.DEBUG:
            return self
        problems = []
        if len(self.SECRET_KEY) < 32:
            problems.append("SECRET_KEY: at least 32 random characters")
        if len(self.ADMIN_SECRET_KEY) < 32 or self.ADMIN_SECRET_KEY == self.SECRET_KEY:
            problems.append("ADMIN_SECRET_KEY: at least 32 random characters, different from SECRET_KEY")
        if "*" in self.CORS_ORIGINS:
            problems.append("CORS_ORIGINS: list the frontend address instead of *")
        if not self.FRONTEND_URL.startswith("https://"):
            problems.append("FRONTEND_URL: the https:// address of the site (used in password reset emails)")
        if problems:
            raise ValueError("Unsafe settings for DEBUG=0: " + "; ".join(problems))
        return self


settings = Settings()
