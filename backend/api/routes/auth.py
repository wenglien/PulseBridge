from __future__ import annotations
"""Authentication routes: register, login, me."""
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from api.auth_deps import get_current_user
from core.rate_limit import LIMIT_AUTH
from core.security import hash_password, verify_password, create_access_token
from db.store import UserRecord, get_store

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    # bcrypt silently truncates past 72 bytes; cap to make that explicit.
    password: str = Field(..., min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


class UserResponse(BaseModel):
    user_id: str
    email: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(LIMIT_AUTH)])
async def register(req: RegisterRequest):
    store = get_store()
    if await asyncio.to_thread(store.get_user_by_email, req.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email 已被使用")
    try:
        user = await asyncio.to_thread(store.create_user, req.email, hash_password(req.password))
    except Exception as e:  # unique-email race (EmailTakenError / IntegrityError)
        if await asyncio.to_thread(store.get_user_by_email, req.email):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email 已被使用") from e
        raise

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, user_id=user.id, email=user.email)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(LIMIT_AUTH)])
async def login(req: LoginRequest):
    user = await asyncio.to_thread(get_store().get_user_by_email, req.email)
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "帳號或密碼錯誤")

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, user_id=user.id, email=user.email)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserRecord = Depends(get_current_user)):
    return UserResponse(user_id=current_user.id, email=current_user.email)
