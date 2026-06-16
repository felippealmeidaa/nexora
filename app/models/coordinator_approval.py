"""
Modelo de aprovacao administrativa para criacao de contas de coordenadores.
"""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, JSON, String

from app.models.base import BaseModel


class CoordinatorApproval(BaseModel):
    __tablename__ = "coordinator_approvals"

    code = Column(String(20), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=False)
    course_names = Column(JSON, nullable=False, default=list)
    is_claimed = Column(Boolean, default=False, nullable=False)
    claimed_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
