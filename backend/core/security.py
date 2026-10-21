from __future__ import annotations
"""JWT creation / verification and password hashing."""
import uuid
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from core.config import settings

# bcrypt is used directly: passlib 1.7.4 crashes on bcrypt >= 4.1 during its
# backend self-test. Hashes are standard $2b$ strings, compatible either way.
_BCRYPT_MAX_BYTES = 72


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode()[:_BCRYPT_MAX_BYTES], bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode()[:_BCRYPT_MAX_BYTES], hashed.encode())
    except ValueError:  # malformed stored hash
        return False


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
