"""
Router para dados em tempo real extraidos do portal docente do Lyceum.
"""

from datetime import datetime
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.professor import Professor
from app.models.user import User, UserRole
from app.security.auth import get_current_user
from app.security.secrets import decrypt_secret
from app.services.historical_analysis_service import HistoricalAnalysisService
from app.services.historical_export_service import ANALYSIS_TITLES, HistoricalExportService
from app.services.live_data_service import LiveDataService
from app.services.scraper_service import scraper_service

router = APIRouter(prefix="/api/live-data", tags=["DadosTempoReal"])

ALLOWED_LIVE_ROLES = {UserRole.PROFESSOR, UserRole.COORDINATOR, UserRole.ADMIN}


def _ensure_live_access(current_user: User) -> None:
    if current_user.role not in ALLOWED_LIVE_ROLES:
        raise HTTPException(status_code=403, detail="Acesso restrito aos perfis com dados em tempo real.")


@router.get("/summary")
def get_live_data_summary(
    course_name: str | None = Query(None),
    professor_user_id: int | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_live_access(current_user)
    service = LiveDataService(db)
    return service.summarize_scope(
        current_user,
        course_name=course_name,
        professor_user_id=professor_user_id,
        search=search,
    )


@router.get("/classes")
def list_live_classes(
    course_name: str | None = Query(None),
    professor_user_id: int | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_live_access(current_user)
    service = LiveDataService(db)
    classes = service.get_scoped_classes(
        current_user,
        course_name=course_name,
        professor_user_id=professor_user_id,
        search=search,
    )
    return [service._serialize_class(live_class, include_students=False) for live_class in classes]


@router.get("/classes/{class_id}")
def get_live_class_detail(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_live_access(current_user)
    service = LiveDataService(db)
    live_class = service.get_class_by_id(class_id, current_user)
    if not live_class:
        raise HTTPException(status_code=404, detail="Turma nao encontrada no seu escopo de acesso.")
    return service._serialize_class(live_class, include_students=True)


@router.get("/student-analysis")
def get_live_student_analysis(
    class_id: int = Query(..., ge=1),
    student_code: str | None = Query(None),
    student_name: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_live_access(current_user)
    if not student_code and not student_name:
        raise HTTPException(status_code=400, detail="Informe o codigo ou o nome do aluno para abrir a analise.")

    service = LiveDataService(db)
    payload = service.build_student_analysis(
        current_user=current_user,
        class_id=class_id,
        student_code=student_code,
        student_name=student_name,
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado nesta turma para o seu escopo.")
    return payload


@router.get("/catalog")
def get_live_catalog(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_live_access(current_user)
    service = LiveDataService(db)
    return {
        "courses": service.build_course_catalog(current_user),
        "filters": {
            "courses": service.list_available_academic_courses(current_user),
            "professors": service.list_available_professors(current_user),
        },
    }


@router.get("/analysis-workspace")
def get_live_analysis_workspace(
    semester: str | None = Query(None),
    course_name: str | None = Query(None),
    subject: str | None = Query(None),
    professor_user_id: int | None = Query(None),
    class_ids: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_live_access(current_user)
    service = LiveDataService(db)
    return service.build_analysis_workspace(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
        professor_user_id=professor_user_id,
        class_ids=class_ids,
    )


@router.get("/analysis-workspace/at-risk-students")
def get_live_at_risk_students_by_class(
    class_key: str = Query(...),
    semester: str | None = Query(None),
    course_name: str | None = Query(None),
    subject: str | None = Query(None),
    professor_user_id: int | None = Query(None),
    class_ids: str | None = Query(None),
    limit: int = Query(4, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_live_access(current_user)
    service = LiveDataService(db)
    bundle = service.get_analysis_workspace_bundle(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
        professor_user_id=professor_user_id,
        class_ids=class_ids,
    )
    rows = bundle["prepared_records"]
    selected = [row for row in rows if row.get("class_key") == class_key]
    if not selected:
        raise HTTPException(status_code=404, detail="Turma nao encontrada para o recorte atual.")

    analysis_service = HistoricalAnalysisService(db)
    payload = analysis_service._serialize_priority_students(selected, limit=limit)
    return {
        "class_key": class_key,
        "total_students": len({row.get("student_name") for row in selected if row.get("student_name")}),
        "at_risk_count": len(payload),
        "students": payload,
    }


@router.get("/analysis-workspace/export")
def export_live_analysis_workspace(
    analysis_id: str = Query(...),
    export_format: str = Query(..., pattern="^(pdf|csv|xlsx|json)$"),
    semester: str | None = Query(None),
    course_name: str | None = Query(None),
    subject: str | None = Query(None),
    professor_user_id: int | None = Query(None),
    class_ids: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_live_access(current_user)
    service = LiveDataService(db)
    export_service = HistoricalExportService()
    workspace = service.build_analysis_workspace(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
        professor_user_id=professor_user_id,
        class_ids=class_ids,
    )

    title = ANALYSIS_TITLES.get(analysis_id)
    if not title:
        raise HTTPException(status_code=400, detail="Analise solicitada nao e suportada para exportacao.")

    rows = export_service.get_analysis_rows(workspace, analysis_id)
    payload = {
        "analysis_id": analysis_id,
        "analysis_title": title,
        "scope": workspace.get("scope", {}),
        "filters": {
            "semester": semester,
            "course_name": course_name,
            "subject": subject,
            "professor_user_id": professor_user_id,
            "class_ids": class_ids,
        },
        "overview": workspace.get("overview", {}),
        "rows": rows,
    }

    if export_format == "json":
        content = export_service.export_json(payload)
        media_type = "application/json"
    elif export_format == "csv":
        content = export_service.export_csv(payload)
        media_type = "text/csv; charset=utf-8"
    elif export_format == "xlsx":
        content = export_service.export_xlsx(payload)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        content = export_service.export_pdf(payload)
        media_type = "application/pdf"

    filename = export_service.build_filename(analysis_id, export_format)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(io.BytesIO(content), media_type=media_type, headers=headers)


@router.post("/refresh")
def refresh_live_snapshot(
    professor_user_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.PROFESSOR, UserRole.ADMIN}:
        raise HTTPException(status_code=403, detail="Apenas professor ou admin podem atualizar os dados em tempo real.")

    target_user = current_user
    if current_user.role == UserRole.ADMIN:
        if not professor_user_id:
            raise HTTPException(status_code=400, detail="Informe o professor_user_id para atualizar os dados.")
        target_user = db.query(User).filter(
            User.id == professor_user_id,
            User.role == UserRole.PROFESSOR,
        ).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Professor nao encontrado para atualizacao.")

    professor = db.query(Professor).filter(Professor.user_id == target_user.id).first()
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado.")

    try:
        lyceum_password = decrypt_secret(professor.lyceum_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not lyceum_password:
        raise HTTPException(status_code=400, detail="Nao existe senha do Lyceum salva para este professor.")

    professor.portal_sync_status = "running"
    professor.portal_sync_error = None
    db.flush()

    portal_result = scraper_service.scrape_professor_portal(target_user.username, lyceum_password)
    if not portal_result.get("success"):
        professor.portal_sync_status = "failed"
        professor.portal_sync_error = (portal_result.get("errors") or ["Falha ao sincronizar com o Lyceum."])[0]
        professor.last_portal_sync_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=400, detail=professor.portal_sync_error)

    service = LiveDataService(db)
    snapshot = service.replace_professor_snapshot(
        professor_user_id=target_user.id,
        professor_name=str(portal_result.get("professor_name") or target_user.full_name or target_user.username),
        classes_payload=portal_result.get("classes", []),
    )
    professor.last_portal_sync_at = snapshot["synced_at"]
    professor.portal_sync_status = "done"
    professor.portal_sync_error = None
    db.commit()

    return {
        "detail": "Dados em tempo real atualizados com sucesso.",
        "snapshot": snapshot,
        "professor_user_id": target_user.id,
        "professor_name": portal_result.get("professor_name") or target_user.full_name,
        "steps": portal_result.get("steps", []),
    }
