from __future__ import annotations
"""
FastAPI dependencies for authentication.
Usage:
    current_user: User = Depends(get_current_user)
    current_user: User = Depends(get_current_user_optional)   # None if unauthenticated
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session as DBSession

from core.security import decode_token
from db.base import get_db
from db.models import User

_bearer = HTTPBearer(auto_error=False)


def _extract_user(
    credentials: Optional[HTTPAuthorizationCredentials],
    db: DBSession,
) -> Optional[User]:
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload:
        return None
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: DBSession = Depends(get_db),
) -> Optional[User]:
    return _extract_user(credentials, db)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: DBSession = Depends(get_db),
) -> User:
    user = _extract_user(credentials, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登入或 token 無效",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
