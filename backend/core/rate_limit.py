from __future__ import annotations
"""
Per-client sliding-window rate limits for the expensive or abusable routes.

In-memory and per instance: on Cloud Run with N instances the effective limit
is up to N× higher. That is fine for its purpose — stopping one client from
draining the LLM quota or brute-forcing logins — without adding a datastore
round-trip to every request.
"""
import math
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from core.config import settings


def client_ip(request: Request) -> str:
    """
    The caller's IP. Behind Cloud Run / Google load balancers the trustworthy
    address is appended to X-Forwarded-For; earlier entries are client-supplied
    and can be forged, so count `forwarded_ip_hops` entries from the right.
    """
    hops = settings.forwarded_ip_hops
    xff = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    if hops > 0 and len(xff) >= hops:
        return xff[-hops]
    return request.client.host if request.client else "unknown"


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, bucket: str, key: str, limit: int, window_s: int) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[(bucket, key)]
            while q and now - q[0] >= window_s:
                q.popleft()
            if len(q) >= limit:
                retry = max(1, math.ceil(window_s - (now - q[0])))
                raise HTTPException(
                    429,
                    f"操作太頻繁了，請在 {retry} 秒後再試",
                    headers={"Retry-After": str(retry)},
                )
            q.append(now)
            if len(self._hits) > 50_000:  # bound memory: drop idle keys
                for k in [k for k, v in self._hits.items() if not v or now - v[-1] >= window_s]:
                    del self._hits[k]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def rate_limit(bucket: str, limit: int, window_s: int):
    """FastAPI dependency: `Depends(rate_limit("analysis", 6, 600))`."""
    async def dependency(request: Request) -> None:
        if settings.rate_limit_enabled:
            limiter.check(bucket, client_ip(request), limit, window_s)
    return dependency


# Shared limits (per client IP)
LIMIT_ANALYSIS = rate_limit("analysis", 6, 600)    # LLM report generation
LIMIT_CHAT = rate_limit("chat", 30, 600)           # LLM follow-up questions
LIMIT_CREATE = rate_limit("create", 20, 600)       # new sessions / uploads
LIMIT_AUTH = rate_limit("auth", 10, 600)           # login / register
LIMIT_LOOKUP = rate_limit("lookup", 60, 60)        # session listing
