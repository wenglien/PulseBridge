from __future__ import annotations
"""SQLAlchemy ORM models."""
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean,
    DateTime, Text, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)               # UUID
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    sync_anchors = relationship("SyncAnchor", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(32), primary_key=True)               # pb_YYYYMMDD_xxxxxx
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(32), default="pending")
    primary_constitution = Column(String(32), nullable=True)
    source = Column(String(16), default="xml")              # "xml" | "healthkit" | "manual"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Full session payload (analysis result, health data, questionnaire) stored as JSON text
    payload_json = Column(Text, nullable=True)

    user = relationship("User", back_populates="sessions")
    health_records = relationship("HealthRecord", back_populates="session", cascade="all, delete-orphan")


class HealthRecord(Base):
    """Incremental HealthKit records associated with a session."""
    __tablename__ = "health_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(32), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    data_type = Column(String(64), nullable=False)          # "hrv" | "ecg" | "sleep" | ...
    recorded_at = Column(DateTime, nullable=False, index=True)
    payload_json = Column(Text, nullable=False)             # Normalized record as JSON

    session = relationship("Session", back_populates="health_records")


class SyncAnchor(Base):
    """Stores the last HKQueryAnchor per user per data type for incremental sync."""
    __tablename__ = "sync_anchors"
    __table_args__ = (UniqueConstraint("user_id", "data_type", name="uq_anchor_user_type"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    data_type = Column(String(64), nullable=False)
    anchor_value = Column(Text, nullable=True)              # serialized HKQueryAnchor
    last_sync_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sync_anchors")
