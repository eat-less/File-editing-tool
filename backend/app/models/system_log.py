import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, Integer, Text, DateTime, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SystemLog(Base):
    __tablename__ = "system_logs"
    __table_args__ = (
        Index("idx_logs_type", "log_type"),
        Index("idx_logs_created", "created_at"),
        Index("idx_logs_module", "module"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    log_type: Mapped[str] = mapped_column(String(20), nullable=False)
    module: Mapped[str | None] = mapped_column(String(50), nullable=True)
    operator_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
