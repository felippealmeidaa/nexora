"""
Router CRUD de Notas.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.grade import Grade
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.grade import GradeCreate, GradeUpdate, GradeResponse, GradeListResponse
from app.security.auth import get_current_user
from app.security.access import can_user_access_student, scope_students_query
from app.security.audit import audit_logger
from app.security.rbac import require_coordinator_or_above

router = APIRouter(prefix="/api/grades", tags=["Notas"])


def _resolve_student_or_404(db: Session, student_id: int) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    return student


@router.get("/", response_model=GradeListResponse)
def list_grades(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    student_id: Optional[int] = None,
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above),
):
    """Lista notas com filtros por aluno e/ou disciplina."""
    query = db.query(Grade)
    scoped_student_ids_subquery = scope_students_query(db, current_user, db.query(Student)).with_entities(Student.id)
    query = query.filter(Grade.student_id.in_(scoped_student_ids_subquery))
    if student_id:
        student = _resolve_student_or_404(db, student_id)
        if not can_user_access_student(db, current_user, student):
            raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")
        query = query.filter(Grade.student_id == student_id)
    if course_id:
        query = query.filter(Grade.course_id == course_id)
    total = query.count()
    grades = query.offset(skip).limit(limit).all()
    return GradeListResponse(total=total, grades=grades)


@router.post("/", response_model=GradeResponse, status_code=201)
def create_grade(
    data: GradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above),
):
    """Registra uma nova nota."""
    student = _resolve_student_or_404(db, data.student_id)
    if current_user.role == UserRole.COORDINATOR and not can_user_access_student(db, current_user, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")
    grade = Grade(**data.model_dump())
    db.add(grade)
    db.commit()
    db.refresh(grade)
    audit_logger.log_data_change(current_user.username, "Grade", "CREATE", grade.id)
    return grade


@router.put("/{grade_id}", response_model=GradeResponse)
def update_grade(
    grade_id: int,
    data: GradeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above),
):
    """Atualiza uma nota."""
    grade = db.query(Grade).filter(Grade.id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Nota não encontrada")

    student = _resolve_student_or_404(db, grade.student_id)
    if current_user.role == UserRole.COORDINATOR and not can_user_access_student(db, current_user, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(grade, field, value)

    db.commit()
    db.refresh(grade)
    audit_logger.log_data_change(current_user.username, "Grade", "UPDATE", grade.id)
    return grade


@router.delete("/{grade_id}", status_code=204)
def delete_grade(
    grade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above),
):
    """Remove uma nota."""
    grade = db.query(Grade).filter(Grade.id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    student = _resolve_student_or_404(db, grade.student_id)
    if current_user.role == UserRole.COORDINATOR and not can_user_access_student(db, current_user, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")
    db.delete(grade)
    db.commit()
    audit_logger.log_data_change(current_user.username, "Grade", "DELETE", grade_id)
