from __future__ import annotations
from pydantic_settings import BaseSettings
from pathlib import Path


DEFAULT_JWT_SECRET = "change-me-generate-a-strong-random-secret"


class Settings(BaseSettings):
    # LLM
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Storage
    data_dir: str = "./data"
    max_csv_file_size_mb: int = 20
    max_xml_size_mb: int = 4096   # decompressed Apple Health export.xml

    # CORS — comma-separated origins + optional regex for dynamic preview URLs
    cors_origins: str = "http://localhost:3000"
    cors_origin_regex: str = ""   # e.g. r"https://your-project\.(web\.app|firebaseapp\.com)$"

    # Security
    rate_limit_enabled: bool = True
    forwarded_ip_hops: int = 1      # trusted X-Forwarded-For entries from the right (Cloud Run: 1)
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30   # 30 days

    # Storage backend: "sql" (SQLAlchemy; SQLite unless DATABASE_URL is set) for local
    # development, "firestore" (Firestore + Cloud Storage) for Cloud Run.
    storage_backend: str = "sql"
    database_url: str = ""
    gcp_project: str = ""
    firestore_database: str = "(default)"
    firestore_prefix: str = ""      # collection/object name prefix, e.g. "staging_"
    gcs_bucket: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def sessions_dir(self) -> Path:
        return Path(self.data_dir) / "sessions"

    @property
    def uploads_dir(self) -> Path:
        return Path(self.data_dir) / "uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        db_path = Path(self.data_dir) / "pulsebridge.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path}"


def is_deployed() -> bool:
    """True on Cloud Run (it always sets K_SERVICE) or whenever cloud storage is in use."""
    import os
    return bool(os.environ.get("K_SERVICE")) or settings.storage_backend == "firestore"


def check_production_secrets() -> None:
    """Refuse to serve with a guessable JWT secret anywhere but a developer machine."""
    weak = settings.jwt_secret == DEFAULT_JWT_SECRET or len(settings.jwt_secret) < 32
    if weak and is_deployed():
        raise RuntimeError(
            "JWT_SECRET is missing, the .env.example placeholder, or shorter than 32 characters. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )


settings = Settings()
