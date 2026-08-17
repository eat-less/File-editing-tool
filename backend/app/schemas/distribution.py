from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid


class PublishRequest(BaseModel):
    change_note: str


class PublishAllRequest(BaseModel):
    change_note: str


class RollbackRequest(BaseModel):
    version: int
    rollback_reason: str


class VersionSnapshotResponse(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    version: int
    change_note: Optional[str] = None
    config_snapshot: Any = None
    manifest: Any = None
    operator_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DistributionLogResponse(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    device_id: uuid.UUID
    version: int
    change_note: Optional[str] = None
    operator_id: Optional[uuid.UUID] = None
    action: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True
