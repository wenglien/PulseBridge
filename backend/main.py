from __future__ import annotations
"""PulseBridge FastAPI application."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import DEFAULT_JWT_SECRET, check_production_secrets, settings
from db.store import get_store
from api.routes import health_data, questionnaire, analysis, sessions
from api.routes import auth, healthkit

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("pulsebridge")


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_production_secrets()
    get_store()  # connect / create tables once, before the first request
    logger.info("Storage backend: %s", settings.storage_backend)
    if settings.jwt_secret == DEFAULT_JWT_SECRET:
        logger.warning("JWT_SECRET is the default placeholder — set a strong secret before deploying.")
    if not settings.groq_api_key:
        logger.warning("GROQ_API_KEY is not set — analysis and chat endpoints will fail.")
    yield


app = FastAPI(
    title="PulseBridge API",
    description="AI 中西醫數位健康助理",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    # Optional regex for Firebase Hosting previews or other dynamic origins.
    # Set CORS_ORIGIN_REGEX in your .env to enable (leave blank to disable).
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health_data.router, prefix="/api")
app.include_router(questionnaire.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(healthkit.router, prefix="/api")


@app.get("/")
async def root():
    return {"name": "PulseBridge API", "version": "2.0.0", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}
