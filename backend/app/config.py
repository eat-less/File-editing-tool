from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:111111@localhost:5432/fff"
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "admin"
    MINIO_SECRET_KEY: str = "123456"
    MINIO_BUCKET: str = "media"
    MINIO_DATA_DIR: str = "D:/dateV1"
    JWT_SECRET: str = "multimedia-jwt-secret-key-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24
    STORAGE_ROOT: str = "storage_root"
    UPLOAD_DIR: str = "uploads"
    CONTROL_API_TOKEN: str = "multimedia-control-token-2026"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
