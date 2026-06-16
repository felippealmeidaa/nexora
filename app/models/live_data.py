"""
Modelos de dados em tempo real extraidos do portal docente do Lyceum.
"""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ProfessorLiveClass(BaseModel):
    __tablename__ = "professor_live_classes"

    professor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    professor_name = Column(String(200), nullable=False)
    external_class_code = Column(String(50), nullable=True, index=True)
    subject_name = Column(String(255), nullable=False, index=True)
    class_code = Column(String(100), nullable=True, index=True)
    academic_course_name = Column(String(255), nullable=True, index=True)
    period_label = Column(String(120), nullable=True, index=True)
    start_date_label = Column(String(40), nullable=True)
    end_date_label = Column(String(40), nullable=True)
    lessons_planned = Column(Integer, nullable=True)
    lessons_given = Column(Integer, nullable=True)
    vacancies = Column(Integer, nullable=True)
    pre_enrolled = Column(Integer, nullable=True)
    enrolled_count = Column(Integer, nullable=True)
    cancelled_count = Column(Integer, nullable=True)
    shift_label = Column(String(80), nullable=True)
    room_label = Column(String(255), nullable=True)
    unit_name = Column(String(255), nullable=True)
    physical_unit_name = Column(String(255), nullable=True)
    workload_label = Column(String(60), nullable=True)
    class_status = Column(String(80), nullable=True)
    detail_url = Column(Text, nullable=True)
    synced_at = Column(DateTime, nullable=False)

    students = relationship(
        "ProfessorLiveStudent",
        back_populates="live_class",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ProfessorLiveStudent(BaseModel):
    __tablename__ = "professor_live_students"

    live_class_id = Column(
        Integer,
        ForeignKey("professor_live_classes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    professor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    student_name = Column(String(255), nullable=False, index=True)
    student_code = Column(String(50), nullable=True, index=True)
    status_label = Column(String(80), nullable=True, index=True)
    academic_course_name = Column(String(255), nullable=True, index=True)
    va1 = Column(Float, nullable=True)
    va2 = Column(Float, nullable=True)
    va3 = Column(Float, nullable=True)
    attendance_percentage = Column(Float, nullable=True)

    live_class = relationship("ProfessorLiveClass", back_populates="students")
