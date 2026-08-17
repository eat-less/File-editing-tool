from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class ExhibitCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ExhibitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ExhibitResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    scene_count: int = 0
    device_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SceneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class SceneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class SceneResponse(BaseModel):
    id: uuid.UUID
    exhibit_id: uuid.UUID
    name: str
    description: Optional[str] = None
    sort_order: int
    device_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeviceCreate(BaseModel):
    name: str
    device_type: str
    unique_code: Optional[str] = None
    ip_address: Optional[str] = None
    design_width: int = 1920
    design_height: int = 1080


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    device_type: Optional[str] = None
    ip_address: Optional[str] = None
    config_file_path: Optional[str] = None
    design_width: Optional[int] = None
    design_height: Optional[int] = None


class DeviceResponse(BaseModel):
    id: uuid.UUID
    scene_id: uuid.UUID
    exhibit_id: uuid.UUID
    name: str
    device_type: str
    unique_code: str
    ip_address: Optional[str] = None
    config_file_path: Optional[str] = None
    design_width: int
    design_height: int
    status: str
    last_online: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
