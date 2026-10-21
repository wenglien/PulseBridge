"""Pytest config — make `backend/` importable and isolate every run's storage."""
import os
import sys
import tempfile
from pathlib import Path

# Must run before core.config is imported anywhere: settings are read once.
_TMP = tempfile.mkdtemp(prefix="pulsebridge-test-")
os.environ["DATA_DIR"] = _TMP
os.environ.setdefault("STORAGE_BACKEND", "sql")
os.environ["DATABASE_URL"] = ""
os.environ.setdefault("GROQ_API_KEY", "test-key")
os.environ["JWT_SECRET"] = "test-only-" + "0" * 54  # long enough for the deployed-mode check

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """Each test starts with empty rate-limit windows."""
    from core.rate_limit import limiter
    limiter.reset()
    yield
