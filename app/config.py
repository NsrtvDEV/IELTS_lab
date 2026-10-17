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
    MAX_AUDIO_SIZE_MB: int = 20

    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
