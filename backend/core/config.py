from __future__ import annotations
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # LLM
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Storage
    data_dir: str = "./data"
    max_csv_file_size_mb: int = 20

    # CORS — comma-separated origins + optional regex for dynamic preview URLs
    cors_origins: str = "http://localhost:3000"
    cors_origin_regex: str = ""   # e.g. r"https://your-project\.(web\.app|firebaseapp\.com)$"

    # Security
    jwt_secret: str = "change-me-generate-a-strong-random-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30   # 30 days

    # Database (blank → SQLite)
    database_url: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def sessions_dir(self) -> Path:
        return Path(self.data_dir) / "sessions"

    @property
    def uploads_dir(self) -> Path:
        return Path(self.data_dir) / "uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        db_path = Path(self.data_dir) / "pulsebridge.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"


settings = Settings()
