from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.models.professor import Professor, ProfessorAcademicCourse, ProfessorCourse
from app.models.student import Student, StudentStatus
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.scraped_data import ScrapedAttendance, ScrapedGrade, ScrapedSubject
from app.security.auth import get_current_user
from app.security.rbac import require_role
from app.security.audit import audit_logger
from app.utils.subject_name import clean_subject_name, normalize_subject_key

router = APIRouter(tags=["Professores"])

ALLOWED_PROFESSOR_ROLES = (UserRole.PROFESSOR, UserRole.ADMIN)

def _build_student_subject_key_map(db: Session, student_ids: list[int]) -> dict[int, set[str]]:
    subject_map: dict[int, set[str]] = {}
    if not student_ids:
        return subject_map

    for model, column in [
        (ScrapedSubject, ScrapedSubject.disciplina),
        (ScrapedGrade, ScrapedGrade.disciplina),
        (ScrapedAttendance, ScrapedAttendance.disciplina),
    ]:
        rows = db.query(model.student_id, column).filter(model.student_id.in_(student_ids)).all()
        for student_id, name in rows:
            subject_key = normalize_subject_key(name)
            if not subject_key:
                continue
            if "metodologia" in subject_key or "trabalhocientifico" in subject_key:
                continue
            subject_map.setdefault(student_id, set()).add(subject_key)

    return subject_map


def _build_student_subject_label_map(db: Session, student_ids: list[int]) -> dict[str, str]:
    label_map: dict[str, str] = {}
    if not student_ids:
        return label_map

    for model, column in [
        (ScrapedSubject, ScrapedSubject.disciplina),
        (ScrapedGrade, ScrapedGrade.disciplina),
        (ScrapedAttendance, ScrapedAttendance.disciplina),
    ]:
        rows = db.query(column).filter(model.student_id.in_(student_ids)).distinct().all()
        for (name,) in rows:
            cleaned_name = clean_subject_name(name)
            subject_key = normalize_subject_key(cleaned_name)
            if subject_key and subject_key not in label_map:
                if "metodologia" in subject_key or "trabalhocientifico" in subject_key:
                    continue
                label_map[subject_key] = cleaned_name

    return label_map


def _get_selected_professor_course_ids(professor: Professor | None) -> set[int]:
    return {
        professor_course.course_id
        for professor_course in (professor.professor_courses if professor else [])
        if professor_course.course_id
    }


def _serialize_selected_professor_courses(db: Session, professor: Professor | None) -> list[dict]:
    if not professor:
        return []

    courses = (
        db.query(Course)
        .join(ProfessorCourse, ProfessorCourse.course_id == Course.id)
        .filter(ProfessorCourse.professor_id == professor.id)
        .order_by(Course.name.asc())
        .all()
    )
    return [
        {
            "id": course.id,
            "name": clean_subject_name(course.name),
            "code": course.code,
            "department": course.department,
        }
        for course in courses
    ]


def _serialize_student_reference(student: Student) -> dict:
    class_schedule = student.class_schedule.value if getattr(student.class_schedule, "value", None) else student.class_schedule
    return {
        "student_id": student.id,
        "student_name": student.name,
        "registration_number": student.registration_number,
        "course_name": student.course_name,
        "current_period": student.current_period,
        "class_schedule": class_schedule,
    }


def _build_professor_course_catalog(
    db: Session,
    professor: Professor | None,
    current_user: User,
    *,
    include_students: bool = False,
) -> list[dict]:
    from sqlalchemy import exists
    academic_course_names = _get_professor_academic_courses(db, professor, current_user)
    query = db.query(Student).filter(
        Student.status == StudentStatus.ACTIVE,
        Student.last_sync_at.isnot(None)
    ).filter(exists().where(ScrapedSubject.student_id == Student.id))

    if academic_course_names:
        query = query.filter(Student.course_name.in_(academic_course_names))
    elif current_user.role != UserRole.ADMIN:
        return []

    students = query.order_by(Student.course_name.asc(), Student.name.asc()).all()
    student_ids = [student.id for student in students]
    if not student_ids:
        return []

    selected_course_ids = _get_selected_professor_course_ids(professor)
    student_subject_keys = _build_student_subject_key_map(db, student_ids)
    subject_label_map = _build_student_subject_label_map(db, student_ids)
    catalog_courses = db.query(Course).all()
    course_by_subject_key = {
        normalize_subject_key(course.name): course
        for course in catalog_courses
        if course.name and normalize_subject_key(course.name)
    }

    grouped_entries: dict[str, dict[str, dict]] = {}

    for student in students:
        academic_course_name = student.course_name or "Sem curso academico"
        academic_bucket = grouped_entries.setdefault(academic_course_name, {})

        for subject_key in student_subject_keys.get(student.id, set()):
            matched_course = course_by_subject_key.get(subject_key)
            display_name = clean_subject_name(
                matched_course.name if matched_course and matched_course.name else subject_label_map.get(subject_key) or subject_key
            )

            entry = academic_bucket.setdefault(subject_key, {
                "academic_course_name": academic_course_name,
                "id": matched_course.id if matched_course else None,
                "name": display_name,
                "code": matched_course.code if matched_course else "",
                "department": matched_course.department if matched_course else None,
                "selected": bool(matched_course and matched_course.id in selected_course_ids),
                "selection_enabled": matched_course is not None,
                "student_count": 0,
                "periods": set(),
                "students": [],
            })

            entry["student_count"] += 1
            if student.current_period is not None:
                entry["periods"].add(student.current_period)
            if include_students:
                entry["students"].append(_serialize_student_reference(student))

    payload: list[dict] = []
    for academic_course_name in sorted(grouped_entries.keys()):
        subject_entries = list(grouped_entries[academic_course_name].values())
        subject_entries.sort(key=lambda item: item["name"].lower())

        for entry in subject_entries:
            entry["periods"] = sorted(entry["periods"])
            if not include_students:
                entry.pop("students", None)
            payload.append(entry)

    return payload


def _ensure_professor_like_access(current_user: User):
    if current_user.role not in ALLOWED_PROFESSOR_ROLES:
        raise HTTPException(status_code=403, detail="Acesso restrito a professores e pro-reitoria")


def _resolve_professor_profile(db: Session, current_user: User, create_for_admin: bool = False) -> Professor | None:
    professor = (
        db.query(Professor)
        .options(joinedload(Professor.professor_courses), joinedload(Professor.academic_courses))
        .filter(Professor.user_id == current_user.id)
        .first()
    )
    if professor or not create_for_admin or current_user.role != UserRole.ADMIN:
        return professor

    professor = Professor(user_id=current_user.id, phone=None)
    db.add(professor)
    db.flush()
    db.refresh(professor)
    return professor
def _get_professor_academic_courses(db: Session, professor: Professor | None, current_user: User) -> list[str]:
    academic_course_names = [ac.course_name for ac in (professor.academic_courses if professor else []) if ac.course_name and normalize_subject_key(ac.course_name) != "engenhariadesoftware"]
    if academic_course_names or current_user.role != UserRole.ADMIN:
        return academic_course_names

    rows = (
        db.query(Student.course_name)
        .filter(Student.status == StudentStatus.ACTIVE, Student.course_name.isnot(None))
        .distinct()
        .all()
    )
    return sorted({row[0] for row in rows if row[0] and normalize_subject_key(row[0]) != "engenhariadesoftware"})


def _get_professor_student_ids(db: Session, professor: Professor | None, current_user: User) -> list[int]:
    from sqlalchemy import exists
    academic_course_names = _get_professor_academic_courses(db, professor, current_user)
    query = db.query(Student.id).filter(
        Student.status == StudentStatus.ACTIVE,
        Student.last_sync_at.isnot(None)
    ).filter(exists().where(ScrapedSubject.student_id == Student.id))

    if academic_course_names:
        query = query.filter(Student.course_name.in_(academic_course_names))
    elif current_user.role != UserRole.ADMIN:
        return []

    return [row[0] for row in query.distinct().all()]


def _get_professor_subject_names(db: Session, student_ids: list[int]) -> list[str]:
    if not student_ids:
        return []

    return sorted(_build_student_subject_label_map(db, student_ids).values())


def _serialize_professor_courses(db: Session, professor: Professor | None, current_user: User) -> list[dict]:
    return _build_professor_course_catalog(db, professor, current_user, include_students=False)


def _get_professor_course_records(db: Session, professor: Professor | None, current_user: User) -> list[Course]:
    course_ids = sorted(_get_selected_professor_course_ids(professor))
    if not course_ids:
        courses = _serialize_professor_courses(db, professor, current_user)
        course_ids = [course["id"] for course in courses if course.get("id")]
    if course_ids:
        return db.query(Course).filter(Course.id.in_(course_ids)).order_by(Course.name.asc()).all()

    if current_user.role == UserRole.ADMIN:
        return db.query(Course).order_by(Course.name.asc()).all()

    return []


@router.get("/api/professors/me")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_professor_like_access(current_user)

    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    return {
        "id": professor.id,
        "user_id": professor.user_id,
        "phone": professor.phone,
        "user_name": current_user.full_name,
        "user_email": current_user.email,
        "courses": _serialize_professor_courses(db, professor, current_user),
        "selected_courses": _serialize_selected_professor_courses(db, professor),
        "selected_course_ids": sorted(_get_selected_professor_course_ids(professor)),
        "academic_courses": _get_professor_academic_courses(db, professor, current_user),
    }


@router.put("/api/professors/me/academic-courses")
def update_my_academic_courses(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_professor_like_access(current_user)

    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    course_names = [str(name).strip() for name in data.get("course_names", []) if str(name).strip()]
    db.query(ProfessorAcademicCourse).filter(ProfessorAcademicCourse.professor_id == professor.id).delete()
    for name in course_names:
        db.add(ProfessorAcademicCourse(professor_id=professor.id, course_name=name))

    db.commit()
    return {"detail": "Cursos academicos atualizados", "course_names": course_names}


@router.get("/api/professors/me/students")
def get_my_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    result = []
    for entry in _build_professor_course_catalog(db, professor, current_user, include_students=True):
        if current_user.role != UserRole.ADMIN and not entry["selected"]:
            continue
        result.append({
            "academic_course_name": entry["academic_course_name"],
            "course_id": entry["id"],
            "course_name": entry["name"],
            "course_code": entry["code"],
            "student_count": entry["student_count"],
            "periods": entry["periods"],
            "selected": entry["selected"],
            "students": entry["students"],
        })

    return result


@router.put("/api/professors/me/courses")
def update_my_courses(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    selected_course_ids = []
    for value in data.get("course_ids", []):
        try:
            course_id = int(value)
        except (TypeError, ValueError):
            continue
        if course_id not in selected_course_ids:
            selected_course_ids.append(course_id)

    valid_courses = db.query(Course.id).filter(Course.id.in_(selected_course_ids)).all()
    valid_course_ids = {vc[0] for vc in valid_courses}
    invalid_ids = [course_id for course_id in selected_course_ids if course_id not in valid_course_ids]
    if invalid_ids:
        raise HTTPException(status_code=400, detail="Uma ou mais disciplinas nao pertencem ao catalogo institucional.")

    db.query(ProfessorCourse).filter(ProfessorCourse.professor_id == professor.id).delete(synchronize_session=False)
    for course_id in selected_course_ids:
        db.add(ProfessorCourse(professor_id=professor.id, course_id=course_id))

    db.commit()
    db.refresh(professor)

    audit_logger.log_data_change(current_user.username, "ProfessorCourse", "UPDATE_SELECTION", professor.id)
    return {
        "detail": "Disciplinas do professor atualizadas com sucesso.",
        "course_ids": selected_course_ids,
        "courses": _serialize_professor_courses(db, professor, current_user),
        "selected_courses": _serialize_selected_professor_courses(db, professor),
    }


@router.get("/api/professors/me/overview")
def get_my_overview(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_professor_like_access(current_user)

    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    from app.services.analytics_service import AnalyticsService
    from app.models.grade import Grade
    from app.analytics.utils import _round

    service = AnalyticsService(db)

    prof_course_ids = [course.id for course in _get_professor_course_records(db, professor, current_user) if course.id]

    if current_user.role != UserRole.ADMIN:
        selected_course_ids = _get_selected_professor_course_ids(professor)
        prof_course_ids = list(selected_course_ids)
        if prof_course_ids:
            catalog = _build_professor_course_catalog(db, professor, current_user, include_students=True)
            seen_student_ids = set()
            for entry in catalog:
                if entry.get("selected"):
                    for s in entry.get("students", []):
                        seen_student_ids.add(s["student_id"])
            student_ids = list(seen_student_ids)
            courses = db.query(Course).filter(Course.id.in_(prof_course_ids)).all()
            discipline_names = [clean_subject_name(c.name) for c in courses if c.name]
        else:
            student_ids = []
            discipline_names = []
    else:
        student_ids = _get_professor_student_ids(db, professor, current_user)
        discipline_names = _get_professor_subject_names(db, student_ids)

    if course_id:
        course = db.query(Course).filter(Course.id == course_id).first()
        cleaned_course_name = clean_subject_name(course.name) if course else None
        if not course or cleaned_course_name not in discipline_names:
            raise HTTPException(status_code=404, detail="Disciplina nao encontrada no seu perfil")
        discipline_names = [cleaned_course_name]
        subject_key = normalize_subject_key(cleaned_course_name)
        student_subject_keys = _build_student_subject_key_map(db, student_ids)
        student_ids = [
            sid for sid in student_ids
            if subject_key in student_subject_keys.get(sid, set())
        ]

    if not student_ids and current_user.role == UserRole.ADMIN:
        from sqlalchemy import exists
        active_students = (
            db.query(Student)
            .filter(
                Student.status == StudentStatus.ACTIVE,
                Student.last_sync_at.isnot(None)
            )
            .filter(exists().where(ScrapedSubject.student_id == Student.id))
            .all()
        )
        student_ids = [student.id for student in active_students]

    if not student_ids:
        return {
            "kpis": {
                "total_students": 0,
                "active_students": 0,
                "total_courses": 0,
                "average_gpa": 0.0,
                "average_attendance_rate": 0.0,
                "at_risk_count": 0,
                "pass_rate": 0.0,
            },
            "risk_summary": {"low": 0, "medium": 0, "high": 0, "critical": 0},
            "top_at_risk": [],
        }

    active_students = db.query(Student).filter(Student.id.in_(student_ids), Student.status == StudentStatus.ACTIVE).all()
    active_ids = [student.id for student in active_students]

    gpas = [service._get_scraped_gpa(student_id) for student_id in active_ids]
    attendance_rates = [service._get_student_attendance_rate(student_id) for student_id in active_ids]
    
    if prof_course_ids:
        selected_courses = db.query(Course).filter(Course.id.in_(prof_course_ids)).all()
        selected_keys = {normalize_subject_key(c.name) for c in selected_courses if c.name}
        all_scraped_grades = db.query(ScrapedGrade).filter(ScrapedGrade.student_id.in_(active_ids)).all()
        all_grades = [
            g.media for g in all_scraped_grades
            if normalize_subject_key(g.disciplina) in selected_keys and g.media > 0
        ]
    else:
        all_grades = [
            g.media for g in db.query(ScrapedGrade).filter(ScrapedGrade.student_id.in_(active_ids)).all()
            if g.media > 0
        ]

    avg_gpa = _round(sum(gpas) / len(gpas), 2) if gpas else 0.0
    avg_attendance = _round(sum(attendance_rates) / len(attendance_rates), 2) if attendance_rates else 0.0
    at_risk = sum(1 for gpa in gpas if gpa < 5.0)
    pass_info = service.stats.compute_pass_rate(all_grades) if all_grades else {"pass_rate": 0.0}

    risk_summary = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for sid, gpa, attendance in zip(active_ids, gpas, attendance_rates):
        _, risk_level = service._get_student_risk(sid, gpa, attendance)
        risk_summary[risk_level] += 1

    student_risks = []
    for student in active_students:
        gpa = service._get_scraped_gpa(student.id)
        attendance = service._get_student_attendance_rate(student.id)
        risk_score, risk_level = service._get_student_risk(student.id, gpa, attendance)
        student_risks.append({
            "student_id": student.id,
            "student_name": student.name,
            "registration_number": student.registration_number,
            "course_name": student.course_name,
            "gpa": _round(gpa, 2),
            "attendance_rate": _round(attendance, 2),
            "risk_score": _round(risk_score, 4),
            "risk_level": risk_level,
        })
    student_risks.sort(key=lambda item: item["risk_score"], reverse=True)

    is_projected = db.query(Grade).filter(
        Grade.student_id.in_(active_ids),
        Grade.description.like("%Projetada%") | Grade.description.like("%✨%")
    ).count() > 0 if active_ids else False
    preventive_risk_count = sum(1 for item in student_risks if item["risk_level"] in ("high", "critical")) if is_projected else 0

    return {
        "kpis": {
            "total_students": len(student_ids),
            "active_students": len(active_ids),
            "total_courses": len(discipline_names),
            "average_gpa": avg_gpa,
            "average_attendance_rate": avg_attendance,
            "at_risk_count": at_risk,
            "pass_rate": pass_info.get("pass_rate", 0.0),
            "is_projected": is_projected,
            "preventive_risk_count": preventive_risk_count,
        },
        "risk_summary": risk_summary,
        "top_at_risk": student_risks[:10],
    }


@router.get("/api/courses/available")
def list_available_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        return []

    return _serialize_professor_courses(db, professor, current_user)

