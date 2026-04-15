from __future__ import annotations
"""
Shared session utilities – thin shim over db.session_store.
All existing callers (routes) continue to use the same function names.
"""
from pathlib import Path
from typing import Optional

from core.config import settings
from db.session_store import (
    generate_session_id,
    load_session,
    save_session,
    list_sessions,
    delete_session,
    _legacy_path as session_path,
)

__all__ = [
    "generate_session_id",
    "load_session",
    "save_session",
    "list_sessions",
    "delete_session",
    "session_path",
]
