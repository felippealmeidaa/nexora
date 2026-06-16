"""
Router de alunos usado pelas telas de analise e consulta institucional.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.models.scraped_data import (
    ScrapedAttendance,
    ScrapedGrade,
    ScrapedSchedule,
    ScrapedSubject,
)
from app.models.student import Student, StudentStatus
from app.models.user import User, UserRole
from app.schemas.student import StudentListResponse, StudentResponse
from app.security.access import (
    can_user_access_student,
    get_user_allowed_subject_keys,
    scope_students_query,
)
from app.security.auth import get_current_user
from app.services.analytics_service import AnalyticsService
from app.services.gemini_service import gemini_service
from app.utils.attendance import normalize_attendance_records
from app.utils.subject_name import normalize_subject_key

router = APIRouter(prefix="/api/students", tags=["Alunos"])


class DraftAlertRequest(BaseModel):
    channel: str = "email"


@router.get("/", response_model=StudentListResponse)
def list_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista alunos visiveis para o usuario autenticado."""
    if current_user.role == UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito ao uso institucional.")

    query = scope_students_query(db, current_user, db.query(Student))

    if status:
        query = query.filter(Student.status == StudentStatus(status))
    if search:
        query = query.filter(
            Student.name.ilike(f"%{search}%")
            | Student.registration_number.ilike(f"%{search}%")
        )

    total = query.count()
    students = query.offset(skip).limit(limit).all()
    return StudentListResponse(total=total, students=students)


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna os dados basicos de um aluno especifico."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    if not can_user_access_student(db, current_user, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")
    return student


@router.get("/{student_id}/detail")
def get_student_detail(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna o pacote completo de detalhes de um aluno para analise institucional."""
    if current_user.role not in (UserRole.PROFESSOR, UserRole.COORDINATOR, UserRole.ADMIN, UserRole.VIEWER):
        raise HTTPException(status_code=403, detail="Acesso restrito a professor, coordenacao e administracao")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    if not can_user_access_student(db, current_user, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")

    allowed_subject_keys = get_user_allowed_subject_keys(db, current_user)

    def subject_is_visible(name: str | None) -> bool:
        if allowed_subject_keys is None:
            return True
        subject_key = normalize_subject_key(name)
        return bool(subject_key and subject_key in allowed_subject_keys)

    scraped_grades = [
        grade
        for grade in db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student.id).all()
        if subject_is_visible(grade.disciplina)
    ]
    grades = [
        {
            "disciplina": grade.disciplina,
            "va1": grade.va1,
            "va2": grade.va2,
            "va3": grade.va3,
            "media": grade.media,
            "situacao": grade.situacao,
        }
        for grade in scraped_grades
    ]
    if not grades:
        db_grades = db.query(Grade).filter(Grade.student_id == student.id).all()
        grades_by_course: dict[str, dict] = {}
        for grade in db_grades:
            course_name = grade.course.name if grade.course else "Disciplina Desconhecida"
            description = (grade.description or "").upper()
            value = grade.value
            entry = grades_by_course.setdefault(
                course_name,
                {
                    "disciplina": course_name,
                    "va1": None,
                    "va1_projected": False,
                    "va2": None,
                    "va2_projected": False,
                    "va3": None,
                    "va3_projected": False,
                    "media": None,
                    "media_projected": False,
                    "situacao": "Cursando",
                    "is_projected": False,
                },
            )
            is_projected = "PROJETADA" in description or "✨" in description
            if "VA1" in description or "P1" in description:
                entry["va1"] = value
                entry["va1_projected"] = is_projected
            elif "VA2" in description or "P2" in description:
                entry["va2"] = value
                entry["va2_projected"] = is_projected
            elif "VA3" in description or "P3" in description:
                entry["va3"] = value
                entry["va3_projected"] = is_projected
            elif "MEDIA" in description or "MÉDIA" in description or "FINAL" in description:
                entry["media"] = value
                entry["media_projected"] = is_projected
            else:
                if entry["va1"] is None:
                    entry["va1"] = value
                    entry["va1_projected"] = is_projected
                elif entry["va2"] is None:
                    entry["va2"] = value
                    entry["va2_projected"] = is_projected
                elif entry["va3"] is None:
                    entry["va3"] = value
                    entry["va3_projected"] = is_projected
            if is_projected:
                entry["is_projected"] = True

        for entry in grades_by_course.values():
            if entry["media"] is None:
                values = [value for value in (entry["va1"], entry["va2"], entry["va3"]) if value is not None]
                if values:
                    entry["media"] = round(sum(values) / len(values), 2)
                    entry["media_projected"] = (
                        entry["va1_projected"] or entry["va2_projected"] or entry["va3_projected"]
                    )
                    if entry["media_projected"]:
                        entry["is_projected"] = True
            if entry["media"] is not None:
                if entry["is_projected"]:
                    entry["situacao"] = "Aprovacao Provavel" if entry["media"] >= 6.0 else "Reprovacao Provavel (Nota)"
                else:
                    entry["situacao"] = "Aprovado" if entry["media"] >= 6.0 else "Reprovado"

        grades = list(grades_by_course.values())

    scraped_attendance = [
        attendance_row
        for attendance_row in db.query(ScrapedAttendance).filter(ScrapedAttendance.student_id == student.id).all()
        if subject_is_visible(attendance_row.disciplina)
    ]
    normalized_attendance = normalize_attendance_records(scraped_attendance)
    attendance = [
        {
            "disciplina": row.disciplina,
            "total_faltas": payload["total_faltas"],
            "total_aulas": payload["total_aulas"],
            "percentual_presenca": payload["percentual_presenca"],
            "faltas_confirmadas": payload["faltas_confirmadas"],
        }
        for row, payload in zip(scraped_attendance, normalized_attendance)
    ]
    if not attendance:
        db_attendance = db.query(Attendance).filter(Attendance.student_id == student.id).all()
        attendance_by_course: dict[str, dict] = {}
        for row in db_attendance:
            course_name = row.course.name if row.course else "Disciplina Desconhecida"
            entry = attendance_by_course.setdefault(
                course_name,
                {
                    "disciplina": course_name,
                    "total_faltas": 0,
                    "total_aulas": 0,
                    "presentes": 0,
                },
            )
            entry["total_aulas"] += 1
            if row.status == AttendanceStatus.ABSENT:
                entry["total_faltas"] += 1
            else:
                entry["presentes"] += 1

        for entry in attendance_by_course.values():
            pct = 100.0
            if entry["total_aulas"] > 0:
                pct = round((entry["presentes"] / entry["total_aulas"]) * 100.0, 2)
            attendance.append(
                {
                    "disciplina": entry["disciplina"],
                    "total_faltas": entry["total_faltas"],
                    "total_aulas": entry["total_aulas"],
                    "percentual_presenca": pct,
                    "faltas_confirmadas": [],
                }
            )

    scraped_subjects = [
        subject
        for subject in db.query(ScrapedSubject).filter(ScrapedSubject.student_id == student.id).all()
        if subject_is_visible(subject.disciplina)
    ]
    subjects = [
        {
            "disciplina": subject.disciplina,
            "situacao": subject.situacao,
            "periodo": subject.periodo,
            "docente": subject.docente,
            "data_inicial": subject.data_inicial,
        }
        for subject in scraped_subjects
    ]
    if not subjects:
        db_enrollments = db.query(Enrollment).filter(Enrollment.student_id == student.id).all()
        for enrollment in db_enrollments:
            course_name = enrollment.course.name if enrollment.course else "Disciplina Desconhecida"
            situation = "Matriculado"
            for grade in grades:
                if grade["disciplina"] == course_name:
                    situation = grade["situacao"]
                    break
            subjects.append(
                {
                    "disciplina": course_name,
                    "situacao": situation,
                    "periodo": student.current_period,
                    "docente": "Professor da Planilha",
                    "data_inicial": None,
                }
            )

    scraped_schedule = [
        schedule_item
        for schedule_item in db.query(ScrapedSchedule).filter(ScrapedSchedule.student_id == student.id).all()
        if subject_is_visible(schedule_item.disciplina)
    ]
    schedule = [
        {
            "dia_semana": row.dia_semana,
            "dia_nome": row.dia_nome,
            "disciplina": row.disciplina,
            "horario_inicio": row.horario_inicio,
            "horario_fim": row.horario_fim,
            "local": row.local,
            "professor": row.professor,
        }
        for row in scraped_schedule
    ]
    schedule.sort(key=lambda item: (item.get("dia_semana") or 99, item.get("horario_inicio") or ""))

    analytics_service = AnalyticsService(db)
    analytics = analytics_service.get_student_overview(student.id)
    analytics_history = [
        item
        for item in (analytics.get("history") or [])
        if subject_is_visible(item.get("disciplina"))
    ]

    visible_grade_values = [float(grade.media) for grade in scraped_grades if grade.media is not None]
    visible_attendance_values = [
        float(item["percentual_presenca"])
        for item in attendance
        if item.get("percentual_presenca") is not None
    ]
    average_gpa = round(sum(visible_grade_values) / len(visible_grade_values), 2) if visible_grade_values else 0.0
    average_attendance = (
        round(sum(visible_attendance_values) / len(visible_attendance_values), 2)
        if visible_attendance_values else 0.0
    )
    failures = sum(1 for grade in grades if str(grade.get("situacao") or "").strip().lower() == "reprovado")
    risk_score = max(0.0, min(1.0, (1 - average_gpa / 10) * 0.6 + (1 - average_attendance / 100) * 0.4))

    filtered_analytics = {
        **analytics,
        "history": analytics_history,
        "kpis": {
            **(analytics.get("kpis") or {}),
            "gpa": average_gpa,
            "attendance_rate": average_attendance,
            "failures": failures,
            "risk_score": round(risk_score, 4),
            "risk_level": analytics_service._classify_risk(risk_score),
        },
    }

    class_schedule = (
        student.class_schedule.value
        if student.class_schedule and hasattr(student.class_schedule, "value")
        else student.class_schedule if isinstance(student.class_schedule, str) else None
    )
    status = student.status.value if student.status else None

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "phone": student.phone,
            "age": student.age,
            "gender": student.gender,
            "cpf": student.cpf,
            "registration_number": student.registration_number,
            "course_name": student.course_name,
            "current_period": student.current_period,
            "class_schedule": class_schedule,
            "status": status,
            "enrollment_date": student.enrollment_date.isoformat() if student.enrollment_date else None,
            "is_working": bool(student.is_working),
            "work_schedule": student.work_schedule,
            "sync_status": student.sync_status,
            "last_sync_at": student.last_sync_at.isoformat() if student.last_sync_at else None,
        },
        "analytics": filtered_analytics,
        "grades": grades,
        "attendance": attendance,
        "subjects": subjects,
        "schedule": schedule,
    }


@router.get("/{student_id}/insights")
async def get_student_insights(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera insights do estudante para professor, coordenador ou admin."""
    if current_user.role not in (UserRole.PROFESSOR, UserRole.COORDINATOR, UserRole.ADMIN, UserRole.VIEWER):
        raise HTTPException(status_code=403, detail="Acesso restrito a professor, coordenacao e administracao")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    if not can_user_access_student(db, current_user, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")

    detail_data = get_student_detail(student_id=student_id, db=db, current_user=current_user)
    analytics_data = detail_data.get("analytics") or {}
    insights = await gemini_service.analyze_student(
        student_name=student.name,
        course=student.course_name,
        kpis=analytics_data.get("kpis") or {},
        history=analytics_data.get("history") or [],
        recommendations=analytics_data.get("recommendations") or [],
        current_grades=detail_data.get("grades") or [],
    )
    return {"insights": insights}


@router.post("/{student_id}/draft-alert")
async def generate_draft_alert(
    student_id: int,
    payload: DraftAlertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera um rascunho de mensagem preventiva para um aluno em risco."""
    if current_user.role not in (UserRole.PROFESSOR, UserRole.COORDINATOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Acesso restrito a professor, coordenacao e administracao")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    if not can_user_access_student(db, current_user, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")

    detail_data = get_student_detail(student_id=student_id, db=db, current_user=current_user)
    analytics_data = detail_data.get("analytics") or {}
    draft = await gemini_service.generate_student_draft_alert(
        student_name=student.name,
        course_name=student.course_name or "Curso Academico",
        kpis=analytics_data.get("kpis") or {},
        current_grades=detail_data.get("grades") or [],
        channel=payload.channel,
    )
    return {"draft": draft}
