"""
Router de Coordenadores.

Endpoints para o coordenador ver seu perfil, alunos do seu curso
e overview analítico.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.user import User, UserRole
from app.models.coordinator import Coordinator
from app.models.student import Student, StudentStatus
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.schemas.coordinator import (
    CoordinatorProfileResponse,
    CoordinatorStudentResponse,
    CoordinatorSubjectStudents,
)
from app.security.auth import get_current_user
from app.security.rbac import require_role

router = APIRouter(tags=["Coordenadores"])


# ═══════════════════════════════════════════════
# ENDPOINTS DO COORDENADOR
# ═══════════════════════════════════════════════

@router.get("/api/coordinators/me", response_model=CoordinatorProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.COORDINATOR)),
):
    """Retorna perfil do coordenador logado."""
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Perfil de coordenador não encontrado")

    return CoordinatorProfileResponse(
        id=coordinator.id,
        user_id=coordinator.user_id,
        phone=coordinator.phone,
        user_name=current_user.full_name,
        user_email=current_user.email,
        academic_course_name=coordinator.academic_course_name,
        course_names=coordinator.course_names or ([coordinator.academic_course_name] if coordinator.academic_course_name else []),
    )


@router.get("/api/coordinators/me/students")
def get_my_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.COORDINATOR)),
):
    """Retorna todos os alunos do curso que o coordenador coordena."""
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Perfil de coordenador não encontrado")

    from sqlalchemy import exists
    from app.models.scraped_data import ScrapedSubject
    students = (
        db.query(Student)
        .filter(
            Student.course_name == coordinator.academic_course_name,
            Student.status == StudentStatus.ACTIVE,
            Student.last_sync_at.isnot(None)
        )
        .filter(exists().where(ScrapedSubject.student_id == Student.id))
        .order_by(Student.name)
        .all()
    )

    return [
        {
            "student_id": s.id,
            "student_name": s.name,
            "registration_number": s.registration_number,
            "course_name": s.course_name,
            "current_period": s.current_period,
            "class_schedule": s.class_schedule.value if s.class_schedule and hasattr(s.class_schedule, "value") else (s.class_schedule if isinstance(s.class_schedule, str) else None),
            "email": s.email,
        }
        for s in students
    ]


@router.get("/api/coordinators/me/subjects")
def get_my_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.COORDINATOR)),
):
    """Retorna todas as disciplinas do curso do coordenador, com alunos matriculados."""
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Perfil de coordenador não encontrado")

    from sqlalchemy import exists
    from app.models.scraped_data import ScrapedSubject
    from app.utils.subject_name import clean_subject_name, normalize_subject_key

    # Obter apenas alunos ativos e sincronizados do curso do coordenador
    students = (
        db.query(Student)
        .filter(
            Student.course_name == coordinator.academic_course_name,
            Student.status == StudentStatus.ACTIVE,
            Student.last_sync_at.isnot(None)
        )
        .filter(exists().where(ScrapedSubject.student_id == Student.id))
        .all()
    )
    student_ids = [s.id for s in students]
    if not student_ids:
        return []

    # Obter todas as disciplinas raspadas dos alunos válidos
    scraped_subjects = (
        db.query(ScrapedSubject)
        .filter(ScrapedSubject.student_id.in_(student_ids))
        .all()
    )

    # Catálogo institucional de disciplinas
    catalog_courses = db.query(Course).all()
    course_by_subject_key = {
        normalize_subject_key(course.name): course
        for course in catalog_courses
        if course.name and normalize_subject_key(course.name)
    }

    # Agrupar estudantes por disciplina
    student_map = {s.id: s for s in students}
    grouped_subjects = {}

    for ss in scraped_subjects:
        subj_name = ss.disciplina
        if not ss.student_id:
            continue
        if not subj_name:
            continue
        cleaned_name = clean_subject_name(subj_name)
        subject_key = normalize_subject_key(cleaned_name)
        if not subject_key:
            continue
        if "metodologia" in subject_key or "trabalhocientifico" in subject_key:
            continue

        student = student_map.get(ss.student_id)
        if not student:
            continue

        matched_course = course_by_subject_key.get(subject_key)

        entry = grouped_subjects.setdefault(subject_key, {
            "course_id": matched_course.id if matched_course else None,
            "course_name": clean_subject_name(matched_course.name if matched_course and matched_course.name else cleaned_name),
            "course_code": matched_course.code if matched_course else "",
            "students_dict": {}
        })

        if student.id not in entry["students_dict"]:
            class_schedule = student.class_schedule.value if student.class_schedule and hasattr(student.class_schedule, "value") else (student.class_schedule if isinstance(student.class_schedule, str) else None)
            entry["students_dict"][student.id] = CoordinatorStudentResponse(
                student_id=student.id,
                student_name=student.name,
                registration_number=student.registration_number,
                course_name=student.course_name,
                current_period=student.current_period,
                class_schedule=class_schedule,
            )

    result = []
    for key in sorted(grouped_subjects.keys()):
        entry = grouped_subjects[key]
        students_list = list(entry["students_dict"].values())
        students_list.sort(key=lambda s: (s.current_period or 0, s.student_name))
        result.append(CoordinatorSubjectStudents(
            course_id=entry["course_id"],
            course_name=entry["course_name"],
            course_code=entry["course_code"],
            students=students_list,
        ))

    result.sort(key=lambda r: r.course_name.lower())
    return result


@router.get("/api/coordinators/me/overview")
def get_my_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.COORDINATOR)),
):
    """
    Retorna overview analítico com KPIs calculados para todos os alunos
    do curso que o coordenador coordena com base em dados do Lyceum.
    """
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Perfil de coordenador não encontrado")

    from app.services.analytics_service import AnalyticsService
    from app.models.scraped_data import ScrapedGrade, ScrapedSubject
    from app.analytics.utils import _round
    from sqlalchemy import exists

    service = AnalyticsService(db)

    # Buscar apenas alunos ativos e sincronizados do curso do coordenador
    students = (
        db.query(Student)
        .filter(
            Student.course_name == coordinator.academic_course_name,
            Student.status == StudentStatus.ACTIVE,
            Student.last_sync_at.isnot(None)
        )
        .filter(exists().where(ScrapedSubject.student_id == Student.id))
        .all()
    )

    if not students:
        return {
            "kpis": {
                "total_students": 0, "active_students": 0, "total_subjects": 0,
                "average_gpa": 0.0, "average_attendance_rate": 0.0,
                "at_risk_count": 0, "pass_rate": 0.0,
            },
            "risk_summary": {"low": 0, "medium": 0, "high": 0, "critical": 0},
            "top_at_risk": [],
        }

    active_ids = [s.id for s in students]

    # Contar disciplinas ativas do curso no Lyceum
    subject_count = (
        db.query(ScrapedSubject.disciplina)
        .filter(ScrapedSubject.student_id.in_(active_ids))
        .distinct()
        .count()
    )

    # KPIs de notas e frequência raspadas do Lyceum
    gpas = [service._get_scraped_gpa(sid) for sid in active_ids]
    attendance_rates = [service._get_student_attendance_rate(sid) for sid in active_ids]

    all_scraped_grades = db.query(ScrapedGrade).filter(ScrapedGrade.student_id.in_(active_ids)).all()
    all_grades = [g.media for g in all_scraped_grades if g.media > 0]

    avg_gpa = _round(sum(gpas) / len(gpas), 2) if gpas else 0.0
    avg_att = _round(sum(attendance_rates) / len(attendance_rates), 2) if attendance_rates else 0.0
    at_risk = sum(1 for g in gpas if g < 5.0)
    pass_info = service.stats.compute_pass_rate(all_grades) if all_grades else {"pass_rate": 0.0}

    # Risk summary
    risk_summary = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for sid, gpa, att in zip(active_ids, gpas, attendance_rates):
        _, risk_level = service._get_student_risk(sid, gpa, att)
        risk_summary[risk_level] += 1

    # Top at risk
    student_risks = []
    for s in students:
        gpa = service._get_scraped_gpa(s.id)
        att = service._get_student_attendance_rate(s.id)
        risk_score, risk_level = service._get_student_risk(s.id, gpa, att)
        student_risks.append({
            "student_id": s.id,
            "student_name": s.name,
            "registration_number": s.registration_number,
            "course_name": s.course_name,
            "gpa": _round(gpa, 2),
            "attendance_rate": _round(att, 2),
            "risk_score": _round(risk_score, 4),
            "risk_level": risk_level,
        })
    student_risks.sort(key=lambda x: x["risk_score"], reverse=True)

    from app.models.grade import Grade
    is_projected = db.query(Grade).filter(
        Grade.student_id.in_(active_ids),
        Grade.description.like("%Projetada%") | Grade.description.like("%✨%")
    ).count() > 0 if active_ids else False
    preventive_risk_count = sum(1 for item in student_risks if item["risk_level"] in ("high", "critical")) if is_projected else 0

    return {
        "kpis": {
            "total_students": len(students),
            "active_students": len(active_ids),
            "total_subjects": subject_count,
            "average_gpa": avg_gpa,
            "average_attendance_rate": avg_att,
            "at_risk_count": at_risk,
            "pass_rate": pass_info.get("pass_rate", 0.0),
            "is_projected": is_projected,
            "preventive_risk_count": preventive_risk_count,
        },
        "risk_summary": risk_summary,
        "top_at_risk": student_risks[:10],
    }

