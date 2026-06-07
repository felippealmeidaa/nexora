from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.models.student import Student, StudentStatus
from app.models.professor import Professor
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.services.analytics_service import AnalyticsService
from app.services.gemini_service import gemini_service
from app.security.auth import get_current_user
from app.security.audit import audit_logger
from app.schemas.analytics import ChatRequest

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_professor_student_ids(db: Session, user_id: int) -> tuple[list[int] | None, list[int] | None]:
    professor = db.query(Professor).filter(Professor.user_id == user_id).first()
    if not professor:
        return [], []

    # Pegar as disciplinas que o professor ministra de fato
    professor_course_ids = [
        pc.course_id for pc in professor.professor_courses if pc.course_id
    ]

    if not professor_course_ids:
        return [], []

    # Buscar alunos matriculados nas disciplinas que o professor ministra
    student_ids = [
        row[0]
        for row in db.query(Enrollment.student_id)
        .join(Student, Student.id == Enrollment.student_id)
        .filter(
            Enrollment.course_id.in_(professor_course_ids),
            Student.status == StudentStatus.ACTIVE
        )
        .distinct()
        .all()
    ]
    return student_ids, professor_course_ids


@router.get('/overview')
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/overview', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)

    return service.get_overview(student_ids=student_ids, course_ids=course_ids)


@router.get('/grades/stats')
def get_grade_stats(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/grades/stats', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)

    return service.get_grade_stats(course_id=course_id, course_ids=course_ids, student_ids=student_ids)


@router.get('/correlations')
def get_correlations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/correlations', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)

    return service.get_correlations(student_ids=student_ids)


@router.get('/pca')
def get_pca(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/pca', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)

    return service.get_pca_analysis(student_ids=student_ids)


@router.get('/predictions')
def get_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/predictions', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)

    return service.get_predictions(student_ids=student_ids)


@router.get('/recommendations')
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/recommendations', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)

    return service.get_recommendations(student_ids=student_ids)


@router.get('/ai-insights')
async def get_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/ai-insights', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)

    overview = service.get_overview(student_ids=student_ids, course_ids=course_ids)
    correlations = service.get_correlations(student_ids=student_ids)
    recommendations = service.get_recommendations(student_ids=student_ids)

    result = await gemini_service.analyze(
        kpis=overview.get('kpis', {}),
        correlations=correlations,
        risk_students=overview.get('top_at_risk', []),
        recommendations_summary={
            'total_recommendations': recommendations.get('total_recommendations', 0),
            'by_priority': recommendations.get('by_priority', {}),
        },
    )
    return result


@router.post('/ai-insights/chat')
async def chat_with_ai(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.PROFESSOR:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para professores')

    audit_logger.log_access(current_user.username, '/api/analytics/ai-insights/chat', 'POST')
    service = AnalyticsService(db)
    student_ids, course_ids = get_professor_student_ids(db, current_user.id)
    overview = service.get_overview(student_ids=student_ids, course_ids=course_ids)
    kpis = overview.get('kpis', {})
    risk_students = overview.get('top_at_risk', [])

    if request.file_content:
        response_text = await gemini_service.chat_with_file(
            message=request.message,
            file_content=request.file_content,
            kpis=kpis,
            risk_students=risk_students,
        )
    else:
        response_text = await gemini_service.chat(
            message=request.message,
            kpis=kpis,
            risk_students=risk_students,
            history=request.history,
        )

    return {'response': response_text}


@router.post('/proreitor/chat')
async def chat_with_proreitor(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para a pró-reitoria')

    audit_logger.log_access(current_user.username, '/api/analytics/proreitor/chat', 'POST')
    
    # Obter estatísticas do pró-reitor
    stats = get_proreitor_stats(db=db, current_user=current_user)
    
    response_text = await gemini_service.chat_proreitor(
        message=request.message,
        ranking_courses=stats.get('ranking_courses', []),
        ranking_subjects=stats.get('ranking_subjects', []),
        top_students=stats.get('top_students', []),
    )
    
    return {'response': response_text}


@router.get('/me')
def get_my_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para alunos')

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail='Perfil de aluno nao encontrado')

    audit_logger.log_access(current_user.username, '/api/analytics/me', 'GET')
    service = AnalyticsService(db)
    return service.get_student_overview(student.id)


@router.get('/me/ai-insights')
async def get_my_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para alunos')

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail='Perfil de aluno nao encontrado')

    audit_logger.log_access(current_user.username, '/api/analytics/me/ai-insights', 'GET')
    service = AnalyticsService(db)
    overview = service.get_student_overview(student.id)
    return await gemini_service.analyze_student_overview(overview)


@router.get('/proreitor/stats')
def get_proreitor_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para a pro-reitoria')

    audit_logger.log_access(current_user.username, '/api/analytics/proreitor/stats', 'GET')

    from collections import defaultdict
    from app.models.student import StudentStatus
    from app.models.scraped_data import ScrapedGrade
    from app.models.grade import Grade
    from app.models.course import Course
    service = AnalyticsService(db)

    active_students = db.query(Student).filter(Student.status == StudentStatus.ACTIVE).all()
    active_ids = [student.id for student in active_students]
    service._preload_caches(active_ids)
    
    student_gpas = []

    for student in active_students:
        has_scraped = len(service._scraped_grades_by_student.get(student.id, [])) > 0
        if has_scraped:
            gpa = service._get_scraped_gpa(student.id)
        else:
            gpa = service._get_student_gpa(student.id)

        student_gpas.append({
            "student_id": student.id,
            "student_name": student.name,
            "registration_number": student.registration_number,
            "course_name": student.course_name or "Desconhecido",
            "gpa": gpa
        })

    # 1. Melhores notas (Top Alunos)
    student_gpas.sort(key=lambda s: s["gpa"], reverse=True)
    top_students = student_gpas[:10]

    # 2. Ranking de Cursos
    courses_data = defaultdict(list)
    for s in student_gpas:
        courses_data[s["course_name"]].append(s)

    ranking_courses = []
    for course_name, students_in_course in courses_data.items():
        if not course_name or course_name == "Desconhecido":
            continue
        gpas_in_course = [s["gpa"] for s in students_in_course if s["gpa"] > 0]
        avg_gpa = round(sum(gpas_in_course) / len(gpas_in_course), 2) if gpas_in_course else 0.0

        sids = [s["student_id"] for s in students_in_course]
        att_rates = [service._get_student_attendance_rate(sid) for sid in sids]
        avg_att = round(sum(att_rates) / len(att_rates), 2) if att_rates else 0.0

        ranking_courses.append({
            "course_name": course_name,
            "student_count": len(students_in_course),
            "average_gpa": avg_gpa,
            "average_attendance": avg_att
        })
    ranking_courses.sort(key=lambda c: c["average_gpa"], reverse=True)

    # 3. Ranking de Disciplinas
    scraped_grades = db.query(ScrapedGrade).all()
    subjects_data = defaultdict(list)
    for sg in scraped_grades:
        if sg.disciplina and sg.media > 0:
            subjects_data[sg.disciplina].append(sg.media)

    ranking_subjects = []
    for subject_name, medias in subjects_data.items():
        avg_media = round(sum(medias) / len(medias), 2) if medias else 0.0
        pass_count = sum(1 for m in medias if m >= 6.0)
        pass_rate = round((pass_count / len(medias)) * 100, 2) if medias else 0.0

        ranking_subjects.append({
            "subject_name": subject_name,
            "average_grade": avg_media,
            "pass_rate": pass_rate,
            "records_count": len(medias)
        })

    if not ranking_subjects:
        grades_regular = db.query(Grade).join(Course, Course.id == Grade.course_id).all()
        subjects_reg = defaultdict(list)
        for g in grades_regular:
            if g.course.name:
                subjects_reg[g.course.name].append(g.value)
        for subject_name, values in subjects_reg.items():
            avg_val = round(sum(values) / len(values), 2) if values else 0.0
            pass_count = sum(1 for v in values if v >= 6.0)
            pass_rate = round((pass_count / len(values)) * 100, 2) if values else 0.0
            ranking_subjects.append({
                "subject_name": subject_name,
                "average_grade": avg_val,
                "pass_rate": pass_rate,
                "records_count": len(values)
            })

    ranking_subjects.sort(key=lambda s: s["average_grade"], reverse=True)

    return {
        "top_students": top_students,
        "ranking_courses": ranking_courses[:15],
        "ranking_subjects": ranking_subjects[:20]
    }


@router.get('/coordinator/ai-insights')
async def get_coordinator_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.COORDINATOR:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para coordenadores')

    audit_logger.log_access(current_user.username, '/api/analytics/coordinator/ai-insights', 'GET')

    from app.models.coordinator import Coordinator
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail='Perfil de coordenador não encontrado')

    # Filtrar estudantes ativos do curso do coordenador
    students = db.query(Student).filter(
        Student.course_name == coordinator.academic_course_name,
        Student.status == StudentStatus.ACTIVE
    ).all()

    student_ids = [s.id for s in students]

    if not student_ids:
        return {"insights": "Nenhum aluno ativo encontrado no seu curso para gerar insights acadêmicos no momento."}

    # Calcular as disciplinas críticas do curso do coordenador
    from collections import defaultdict
    from app.models.scraped_data import ScrapedGrade
    from app.models.grade import Grade
    
    subjects_data = defaultdict(list)
    
    scraped_grades = db.query(ScrapedGrade).filter(ScrapedGrade.student_id.in_(student_ids)).all()
    for sg in scraped_grades:
        if sg.disciplina and sg.media > 0:
            subjects_data[sg.disciplina].append(sg.media)
            
    if not scraped_grades:
        grades = db.query(Grade).join(Course, Course.id == Grade.course_id).filter(Grade.student_id.in_(student_ids)).all()
        for g in grades:
            if g.course.name:
                subjects_data[g.course.name].append(g.value)
                
    critical_subjects = []
    for subject_name, medias in subjects_data.items():
        avg_media = round(sum(medias) / len(medias), 2) if medias else 0.0
        pass_count = sum(1 for m in medias if m >= 6.0)
        pass_rate = round((pass_count / len(medias)) * 100, 2) if medias else 0.0
        critical_subjects.append({
            "subject_name": subject_name,
            "average_grade": avg_media,
            "pass_rate": pass_rate,
            "records_count": len(medias)
        })
        
    critical_subjects.sort(key=lambda s: s["pass_rate"])

    service = AnalyticsService(db)
    overview = service.get_overview(student_ids=student_ids)

    insights = await gemini_service.generate_coordinator_insights(
        course_name=coordinator.academic_course_name,
        kpis=overview.get('kpis', {}),
        risk_students=overview.get('top_at_risk', []),
        critical_subjects=critical_subjects,
    )
    return {"insights": insights}


@router.get('/proreitor/ai-insights')
async def get_proreitor_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para a pró-reitoria')

    audit_logger.log_access(current_user.username, '/api/analytics/proreitor/ai-insights', 'GET')

    # Reutiliza a lógica existente em get_proreitor_stats
    stats = get_proreitor_stats(db=db, current_user=current_user)

    insights = await gemini_service.generate_proreitor_insights(
        ranking_courses=stats.get('ranking_courses', []),
        ranking_subjects=stats.get('ranking_subjects', []),
        top_students=stats.get('top_students', []),
    )
    return {"insights": insights}

