from __future__ import annotations
"""SQLAlchemy declarative base and engine setup."""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from core.config import settings

_db_url = settings.resolved_database_url
engine = create_engine(
    _db_url,
    connect_args={"check_same_thread": False} if "sqlite" in _db_url else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create all tables (called on startup) and add columns introduced later."""
    from db import models  # noqa: F401 – register models with Base
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


# Columns added after the first release; create_all() never alters existing tables.
_LATE_COLUMNS = {
    "sessions": {"token_hash": "VARCHAR(64)", "progress": "FLOAT DEFAULT 0", "metrics_json": "TEXT"},
}


def _add_missing_columns() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, cols in _LATE_COLUMNS.items():
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
