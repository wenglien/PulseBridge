from __future__ import annotations
"""Pick the storage backend once per process (STORAGE_BACKEND=sql|firestore)."""
from functools import lru_cache

from core.config import settings
from db.store.base import SessionMeta, Store, UserRecord, token_matches


@lru_cache(maxsize=1)
def get_store() -> Store:
    if settings.storage_backend == "firestore":
        from db.store.firestore import FirestoreStore
        return FirestoreStore()
    if settings.storage_backend == "sql":
        from db.store.sql import SqlStore
        return SqlStore()
    raise ValueError(f"Unknown STORAGE_BACKEND: {settings.storage_backend!r} (expected 'sql' or 'firestore')")


__all__ = ["get_store", "Store", "SessionMeta", "UserRecord", "token_matches"]
