"""Schemas Pydantic para Coordenador."""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List

from app.schemas.validators import digits_only


class CoordinatorRegisterRequest(BaseModel):
    """Dados para criacao final da conta do coordenador via codigo aprovado."""
    registration_code: str = Field(..., min_length=5, max_length=5, description="Codigo de matricula de 5 digitos")
    password: str = Field(..., min_length=6)

    @field_validator('registration_code')
    @classmethod
    def validate_registration_code(cls, value: str) -> str:
        digits = digits_only(value, 5) or ''
        if len(digits) != 5:
            raise ValueError('O codigo de matricula deve ter exatamente 5 digitos.')
        return digits


class CoordinatorProfileResponse(BaseModel):
    """Perfil do coordenador."""
    id: int
    user_id: int
    phone: Optional[str] = None
    user_name: str
    user_email: str
    academic_course_name: str
    course_names: List[str] = []


class CoordinatorStudentResponse(BaseModel):
    """Aluno na visao do coordenador."""
    student_id: int
    student_name: str
    registration_number: str
    course_name: Optional[str] = None
    current_period: Optional[int] = None
    class_schedule: Optional[str] = None


class CoordinatorSubjectStudents(BaseModel):
    """Alunos de uma materia do curso do coordenador."""
    course_id: int
    course_name: str
    course_code: str
    students: List[CoordinatorStudentResponse] = []


class CoordinatorApprovalCreateRequest(BaseModel):
    code: str = Field(..., min_length=5, max_length=20)
    full_name: str = Field(..., min_length=2, max_length=200)
    course_names: List[str] = Field(default=[])

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if len(cleaned) < 5:
            raise ValueError("Informe um codigo valido.")
        return cleaned

    @field_validator("course_names")
    @classmethod
    def validate_course_names(cls, values: List[str]) -> List[str]:
        cleaned = []
        seen = set()
        for value in values or []:
            name = str(value or "").strip()
            key = name.casefold()
            if name and key not in seen:
                cleaned.append(name)
                seen.add(key)
        if not cleaned:
            raise ValueError("Selecione ao menos um curso para o coordenador.")
        return cleaned
