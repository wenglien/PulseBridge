from __future__ import annotations
"""
FastAPI dependencies for authentication.
Usage:
    current_user: UserRecord = Depends(get_current_user)
    current_user: UserRecord | None = Depends(get_current_user_optional)
"""
import asyncio
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.security import decode_token
from db.store import UserRecord, get_store

_bearer = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[UserRecord]:
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        return None
    return await asyncio.to_thread(get_store().get_user, payload["sub"])


async def get_current_user(
    user: Optional[UserRecord] = Depends(get_current_user_optional),
) -> UserRecord:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登入或 token 無效",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
