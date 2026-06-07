"""
Modelo para registro de tentativas de login (Rate Limit & Lockout).
"""

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, String

from app.models.base import BaseModel


class LoginAttempt(BaseModel):
    """Registro de cada tentativa de autenticação."""

    __tablename__ = "login_attempts"

    ip_address = Column(String(100), nullable=False, index=True)
    username = Column(String(100), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    is_successful = Column(Boolean, default=False, nullable=False)
