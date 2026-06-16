from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional

from app.schemas.validators import (
    digits_only,
    validate_cpf_value,
    validate_email_value,
    validate_phone_value,
)


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4)


class ProfessorRegisterRequest(BaseModel):
    lyceum_login: str = Field(..., min_length=3, max_length=100)
    lyceum_password: str = Field(..., min_length=4, max_length=200)

    @field_validator('lyceum_login')
    @classmethod
    def validate_lyceum_login(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if len(cleaned) < 3:
            raise ValueError("Informe o login do Lyceum.")
        return cleaned


class LyceumPasswordUpdateRequest(BaseModel):
    lyceum_password: str = Field(..., min_length=4, max_length=200)
    confirm_lyceum_password: str = Field(..., min_length=4, max_length=200)

    @field_validator("confirm_lyceum_password")
    @classmethod
    def validate_matching_lyceum_passwords(cls, value: str, info) -> str:
        original = info.data.get("lyceum_password")
        if original is not None and str(value) != str(original):
            raise ValueError("A confirmacao da senha do Lyceum nao confere.")
        return value


class SystemPasswordUpdateRequest(BaseModel):
    current_password: str = Field(..., min_length=4, max_length=200)
    new_password: str = Field(..., min_length=4, max_length=200)
    confirm_new_password: str = Field(..., min_length=4, max_length=200)

    @field_validator("confirm_new_password")
    @classmethod
    def validate_matching_system_passwords(cls, value: str, info) -> str:
        new_password = info.data.get("new_password")
        if new_password is not None and str(value) != str(new_password):
            raise ValueError("A confirmacao da nova senha do NEXORA nao confere.")
        return value


class LoginResponse(BaseModel):
    authenticated: bool = True
    token_type: str = 'session_cookie'
    role: str
    username: str
    expires_in_seconds: int


class SessionInfoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_identifier: str
    device_label: Optional[str] = None
    device_id: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    refresh_expires_at: datetime
    access_expires_at: datetime
    last_seen_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revoked_reason: Optional[str] = None
    is_current: bool = False


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    email: str
    role: str
    is_active: bool
