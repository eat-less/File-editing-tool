from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "normal"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    token: str
    user: UserResponse
