from __future__ import annotations
"""PulseBridge FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from db.base import init_db
from api.routes import health_data, questionnaire, analysis, sessions
from api.routes import auth, healthkit

app = FastAPI(
    title="PulseBridge API",
    description="AI 中西醫數位健康助理",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in settings.cors_origins_list if o],
    # Optional regex for Firebase Hosting previews or other dynamic origins.
    # Set CORS_ORIGIN_REGEX in your .env to enable (leave blank to disable).
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()


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
