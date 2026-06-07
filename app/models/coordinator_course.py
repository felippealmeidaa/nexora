"""
Modelo de associação Coordenador-Disciplina (CoordinatorCourse).

Permite que coordenadores que também lecionam tenham disciplinas
especificamente associadas à sua conta desde o registro.
"""

from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class CoordinatorCourse(BaseModel):
    """
    Associação Coordenador-Disciplina.
    """

    __tablename__ = "coordinator_courses"

    coordinator_id = Column(Integer, ForeignKey("coordinators.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)

    # Relacionamentos
    coordinator = relationship("Coordinator", backref="coordinator_courses", cascade="all")
    course = relationship("Course")

    def __repr__(self) -> str:
        return f"<CoordinatorCourse(coordinator={self.coordinator_id}, course={self.course_id})>"
