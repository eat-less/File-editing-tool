from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid


class ProgramCreate(BaseModel):
    device_id: str
    scene_id: str
    exhibit_id: str
    name: str


class ProgramCopy(BaseModel):
    target_device_ids: list[str]


class ConfigSave(BaseModel):
    config: dict[str, Any]


class ProgramResponse(BaseModel):
    id: uuid.UUID
    device_id: uuid.UUID
    scene_id: uuid.UUID
    exhibit_id: uuid.UUID
    name: str
    config: Any = None
    current_version: int = 0
    published_version: int = 0
    publish_status: str = "unpublished"
    exhibit_name: Optional[str] = None
    scene_name: Optional[str] = None
    device_name: Optional[str] = None
    exhibit_path: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
