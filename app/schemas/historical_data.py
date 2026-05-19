from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime


class HistoricalRecordBase(BaseModel):
    semester: str
    course_name: str
    subject: Optional[str] = None
    period: Optional[int] = None
    student_name: str
    grades: Optional[Dict[str, Any]] = None
    attendance: Optional[float] = None


class HistoricalRecordCreate(HistoricalRecordBase):
    pass


class HistoricalRecordResponse(HistoricalRecordBase):
    id: int
    professor_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class HistoricalUploadSummary(BaseModel):
    avg_attendance: Optional[float] = None
    avg_grade: Optional[float] = None
    students: int = 0
    classes: int = 0
    semesters: int = 0


class HistoricalUploadClassGroup(BaseModel):
    key: str
    semester: str
    course_name: str
    subject: str
    period_label: str
    student_count: int = 0
    avg_attendance: Optional[float] = None
    avg_grade: Optional[float] = None
    attention_count: int = 0


class HistoricalUploadResponse(BaseModel):
    message: str
    records_count: int
    semester: str
    course_organized: bool
    courses: List[str] = Field(default_factory=list)
    subjects: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    normalization_steps: List[str] = Field(default_factory=list)
    summary: Optional[HistoricalUploadSummary] = None
    class_groups: List[HistoricalUploadClassGroup] = Field(default_factory=list)
