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
from app.services.historical_analysis_service import HistoricalAnalysisService
from app.services.live_data_service import LiveDataService
from app.security.auth import get_current_user
from app.security.audit import audit_logger
from app.schemas.analytics import AssistantChatRequest, ChatRequest

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


def _summarize_live_workspace(db: Session, current_user: User) -> dict:
    service = LiveDataService(db)
    workspace = service.build_analysis_workspace(current_user=current_user)
    overview = workspace.get("overview", {})
    top_at_risk = workspace.get("overview", {}).get("top_at_risk", [])
    classes = workspace.get("analysis_data", {}).get("by_class", [])
    return {
        "label": "dados em tempo real do Lyceum",
        "workspace": workspace,
        "kpis": {
            "total_students": overview.get("total_students", 0),
            "average_gpa": overview.get("avg_grade", 0.0),
            "average_attendance_rate": overview.get("avg_attendance", 0.0),
            "at_risk_count": sum(
                1 for row in top_at_risk
                if row.get("risk_level") in {"high", "critical"}
            ),
        },
        "risk_students": top_at_risk[:12],
        "summary_lines": [
            f"Turmas em tempo real consideradas: {overview.get('total_classes', 0)}",
            f"Alunos em tempo real considerados: {overview.get('total_students', 0)}",
            f"Media atual de notas: {overview.get('avg_grade', 0.0)}",
            f"Frequencia media atual: {overview.get('avg_attendance', 0.0)}%",
            f"Base historica usada como reforco de treinamento: {overview.get('historical_training_records', 0)} registros",
        ] + [
            f"Turma critica: {row.get('label')} | media={row.get('avg_grade')} | risco={row.get('risk_score')}"
            for row in classes[:5]
        ],
    }


def _summarize_historical_workspace(db: Session, current_user: User) -> dict:
    service = HistoricalAnalysisService(db)
    workspace = service.build_workspace(current_user=current_user)
    overview = workspace.get("overview", {})
    discipline_risk = workspace.get("analysis_data", {}).get("discipline_risk", [])
    return {
        "label": "planilhas historicas",
        "workspace": workspace,
        "kpis": {
            "total_students": overview.get("total_students", 0),
            "average_gpa": overview.get("avg_grade", 0.0),
            "average_attendance_rate": overview.get("avg_attendance", 0.0),
            "at_risk_count": len(overview.get("top_at_risk", []) or []),
        },
        "risk_students": (overview.get("top_at_risk", []) or [])[:12],
        "summary_lines": [
            f"Registros historicos analisados: {overview.get('total_records', 0)}",
            f"Alunos historicos mapeados: {overview.get('total_students', 0)}",
            f"Media historica de notas: {overview.get('avg_grade', 0.0)}",
            f"Frequencia historica media: {overview.get('avg_attendance', 0.0)}%",
            "Objetivo desta base: treinar previsoes, detectar padroes e reforcar leitura de risco do modo em tempo real.",
        ] + [
            f"Disciplina historicamente sensivel: {row.get('label')} | media={row.get('avg_grade')} | risco={row.get('risk_score')}"
            for row in discipline_risk[:5]
        ],
    }


def _merge_assistant_payload(source: str, live_payload: dict | None, historical_payload: dict | None) -> tuple[dict, list[dict], str]:
    selected_payloads = []
    if source in {"live", "both"} and live_payload:
        selected_payloads.append(live_payload)
    if source in {"historical", "both"} and historical_payload:
        selected_payloads.append(historical_payload)

    merged_kpis = {
        "total_students": max((payload.get("kpis", {}).get("total_students", 0) for payload in selected_payloads), default=0),
        "average_gpa": round(sum(payload.get("kpis", {}).get("average_gpa", 0.0) for payload in selected_payloads) / max(len(selected_payloads), 1), 2),
        "average_attendance_rate": round(sum(payload.get("kpis", {}).get("average_attendance_rate", 0.0) for payload in selected_payloads) / max(len(selected_payloads), 1), 2),
        "at_risk_count": sum(payload.get("kpis", {}).get("at_risk_count", 0) for payload in selected_payloads),
    }
    merged_risk_students = []
    for payload in selected_payloads:
        merged_risk_students.extend(payload.get("risk_students", []))

    context_blocks = []
    for payload in selected_payloads:
        context_blocks.append(
            f"BASE: {payload.get('label')}\n" + "\n".join(payload.get("summary_lines", []))
        )

    return merged_kpis, merged_risk_students[:18], "\n\n".join(context_blocks)


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


@router.post('/assistant-chat')
async def chat_with_unified_assistant(
    request: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.PROFESSOR, UserRole.COORDINATOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail='Acesso restrito aos perfis academicos com IA contextual')

    source = str(request.source or 'both').lower()
    if source not in {'live', 'historical', 'both'}:
        raise HTTPException(status_code=400, detail='Fonte de conhecimento invalida')

    live_payload = _summarize_live_workspace(db, current_user) if source in {'live', 'both'} else None
    historical_payload = _summarize_historical_workspace(db, current_user) if source in {'historical', 'both'} else None
    merged_kpis, merged_risk_students, context_block = _merge_assistant_payload(source, live_payload, historical_payload)

    scoped_message = (
        f"Perfil atual: {current_user.role.value.lower()}.\n"
        f"Fonte de conhecimento escolhida: {source}.\n"
        "Use os dados abaixo como contexto factual do sistema. "
        "Quando a base historica estiver presente, trate-a como referencia de padroes, treinamento e comportamento "
        "para apoiar previsoes e recomendacoes do modo em tempo real.\n\n"
        f"{context_block}\n\n"
        f"Pergunta do usuario: {request.message}"
    )

    response_text = await gemini_service.chat(
        message=scoped_message,
        kpis=merged_kpis,
        risk_students=merged_risk_students,
        history=request.history,
    )
    return {
        'response': response_text,
        'source': source,
        'context': {
            'live_available': live_payload is not None,
            'historical_available': historical_payload is not None,
        },
    }


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

