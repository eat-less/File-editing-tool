import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, Integer, BigInteger, Boolean, DateTime, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Program(Base):
    __tablename__ = "programs"
    __table_args__ = (UniqueConstraint("device_id", "scene_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    scene_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False)
    exhibit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exhibits.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, default=lambda: {"pages": [], "device": {"designWidth": 1920, "designHeight": 1080}})
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    published_version: Mapped[int] = mapped_column(Integer, default=0)
    publish_status: Mapped[str] = mapped_column(String(20), default="unpublished")
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    creator_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hash_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    bucket: Mapped[str] = mapped_column(String(100), default="media")
    local_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    exhibit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("exhibits.id", ondelete="SET NULL"), nullable=True)
    scene_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="SET NULL"), nullable=True)
    reference_count: Mapped[int] = mapped_column(Integer, default=0)
    uploader_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
