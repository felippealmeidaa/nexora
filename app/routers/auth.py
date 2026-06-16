"""
Router de autenticacao.

Endpoints para registro de usuarios, login, refresh e gerenciamento de sessoes.
"""

from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.coordinator import Coordinator
from app.models.coordinator_approval import CoordinatorApproval
from app.models.course import Course
from app.models.professor import Professor
from app.models.user import User, UserRole
from app.models.user_session import UserSession
from app.models.login_attempt import LoginAttempt
from app.models.coordinator_course import CoordinatorCourse
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ProfessorRegisterRequest,
    LyceumPasswordUpdateRequest,
    SessionInfoResponse,
    SystemPasswordUpdateRequest,
    UserResponse,
)
from app.schemas.coordinator import CoordinatorRegisterRequest
from app.security.audit import audit_logger
from app.security.auth import (
    clear_session_cookies,
    create_access_token,
    get_current_user,
    set_refresh_cookie,
    set_session_cookie,
)
from app.security.hashing import hash_password, verify_password
from app.security.secrets import encrypt_secret
from app.services.live_data_service import LiveDataService
from app.services.scraper_service import scraper_service
from app.security.session import (
    create_session_payload,
    create_user_session,
    generate_refresh_token,
    get_client_ip,
    get_device_id,
    revoke_all_user_sessions,
    revoke_session,
    rotate_refresh_session,
    validate_refresh_session,
)

router = APIRouter(prefix="/api/auth", tags=["Autenticacao"])


def _build_placeholder_email(prefix: str, identifier: str) -> str:
    safe_identifier = "".join(char for char in str(identifier or "").lower() if char.isalnum() or char in {"-", "_", "."})
    safe_identifier = safe_identifier or "usuario"
    return f"{prefix}-{safe_identifier}@nexora.local"


def _resolve_user_for_login(identifier: str, db: Session) -> User | None:
    return db.query(User).filter(
        (User.username == identifier)
        | (User.email == identifier)
    ).first()


def _apply_session_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    set_session_cookie(response, access_token)
    set_refresh_cookie(response, refresh_token)


def _build_access_token(user: User, session_identifier: str, access_jti: str) -> str:
    return create_access_token(
        data={
            "sub": user.username,
            "role": user.role.value,
            "sid": session_identifier,
            "jti": access_jti,
        }
    )


def _serialize_sessions(
    sessions: list[UserSession],
    current_session_identifier: str | None,
) -> list[SessionInfoResponse]:
    payload = []
    for session in sessions:
        payload.append(SessionInfoResponse(
            id=session.id,
            session_identifier=session.session_identifier,
            device_label=session.device_label,
            device_id=session.device_id,
            user_agent=session.user_agent,
            ip_address=session.ip_address,
            refresh_expires_at=session.refresh_expires_at,
            access_expires_at=session.access_expires_at,
            last_seen_at=session.last_seen_at,
            revoked_at=session.revoked_at,
            revoked_reason=session.revoked_reason,
            is_current=session.session_identifier == current_session_identifier,
        ))
    return payload


@router.post("/register/professor", response_model=UserResponse, status_code=201)
def register_professor(data: ProfessorRegisterRequest, db: Session = Depends(get_db)):
    """Registra um professor validando as credenciais diretamente no Lyceum."""
    lyceum_login = data.lyceum_login.strip()
    if db.query(User).filter(User.username == lyceum_login).first():
        raise HTTPException(status_code=400, detail="Ja existe uma conta cadastrada com este login do Lyceum.")

    portal_result = scraper_service.scrape_professor_portal(lyceum_login, data.lyceum_password)
    if not portal_result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=portal_result.get("errors", ["Nao foi possivel validar as credenciais no Lyceum."])[0],
        )

    professor_name = str(portal_result.get("professor_name") or lyceum_login).strip()
    placeholder_email = _build_placeholder_email("prof", lyceum_login)
    if db.query(User).filter(User.email == placeholder_email).first():
        placeholder_email = _build_placeholder_email("prof", f"{lyceum_login}-{int(datetime.utcnow().timestamp())}")

    user = User(
        username=lyceum_login,
        full_name=professor_name,
        email=placeholder_email,
        hashed_password=hash_password(data.lyceum_password),
        role=UserRole.PROFESSOR,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    db.flush()

    professor = Professor(
        user_id=user.id,
        phone=None,
        lyceum_password=encrypt_secret(data.lyceum_password),
        last_portal_sync_at=datetime.utcnow(),
        portal_sync_status="done",
        portal_sync_error=None,
    )
    db.add(professor)
    db.flush()

    live_data_service = LiveDataService(db)
    live_data_service.replace_professor_snapshot(
        professor_user_id=user.id,
        professor_name=professor_name,
        classes_payload=portal_result.get("classes", []),
    )

    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(lyceum_login, "Professor", "CREATE", user.id)
    return user


@router.post("/register/coordinator", response_model=UserResponse, status_code=201)
def register_coordinator(data: CoordinatorRegisterRequest, db: Session = Depends(get_db)):
    """Conclui o cadastro de um coordenador a partir de um codigo previamente aprovado pelo admin."""
    approval = db.query(CoordinatorApproval).filter(CoordinatorApproval.code == data.registration_code).first()
    if not approval:
        raise HTTPException(status_code=400, detail="Codigo de coordenador nao aprovado pelo admin.")
    if approval.is_claimed:
        raise HTTPException(status_code=400, detail="Este codigo de coordenador ja foi utilizado.")
    if db.query(User).filter(User.username == data.registration_code).first():
        raise HTTPException(status_code=400, detail="Ja existe uma conta criada com este codigo.")

    placeholder_email = _build_placeholder_email("coord", data.registration_code)
    if db.query(User).filter(User.email == placeholder_email).first():
        placeholder_email = _build_placeholder_email("coord", f"{data.registration_code}-{int(datetime.utcnow().timestamp())}")

    user = User(
        username=data.registration_code,
        full_name=approval.full_name,
        email=placeholder_email,
        hashed_password=hash_password(data.password),
        role=UserRole.COORDINATOR,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    db.flush()

    course_names = [str(name).strip() for name in (approval.course_names or []) if str(name).strip()]
    primary_course_name = course_names[0] if course_names else "Curso nao informado"
    coordinator = Coordinator(
        user_id=user.id,
        phone=None,
        academic_course_name=primary_course_name,
        course_names=course_names,
    )
    db.add(coordinator)
    db.flush()

    course_ids = []
    if course_names:
        course_ids = [
            row[0]
            for row in db.query(Course.id)
            .filter(Course.department.in_(course_names) | Course.name.in_(course_names))
            .all()
        ]

    for course_id in course_ids:
        db.add(CoordinatorCourse(
            coordinator_id=coordinator.id,
            course_id=course_id,
        ))

    approval.is_claimed = True
    approval.claimed_user_id = user.id

    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(data.registration_code, "Coordinator", "CREATE", user.id)
    return user


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Autentica usuario, cria sessao persistida e seta cookies de acesso e refresh com rate limit e lockout."""
    identifier = data.identifier.strip()
    password = data.password.strip()
    client_ip = get_client_ip(request)

    # Verificar rate limit e lockout de login
    fifteen_minutes_ago = datetime.utcnow() - timedelta(minutes=15)

    failed_attempts_by_ip = db.query(LoginAttempt).filter(
        LoginAttempt.ip_address == client_ip,
        LoginAttempt.timestamp >= fifteen_minutes_ago,
        LoginAttempt.is_successful == False
    ).count()

    failed_attempts_by_user = db.query(LoginAttempt).filter(
        LoginAttempt.username == identifier,
        LoginAttempt.timestamp >= fifteen_minutes_ago,
        LoginAttempt.is_successful == False
    ).count()

    if failed_attempts_by_ip >= 5 or failed_attempts_by_user >= 5:
        # Calcular tempo restante para expirar a primeira tentativa da janela de 15 min
        oldest_attempt = None
        if failed_attempts_by_ip >= 5:
            oldest_attempt = db.query(LoginAttempt).filter(
                LoginAttempt.ip_address == client_ip,
                LoginAttempt.timestamp >= fifteen_minutes_ago,
                LoginAttempt.is_successful == False
            ).order_by(LoginAttempt.timestamp.asc()).first()

        if failed_attempts_by_user >= 5:
            oldest_user_attempt = db.query(LoginAttempt).filter(
                LoginAttempt.username == identifier,
                LoginAttempt.timestamp >= fifteen_minutes_ago,
                LoginAttempt.is_successful == False
            ).order_by(LoginAttempt.timestamp.asc()).first()
            if not oldest_attempt or (oldest_user_attempt and oldest_user_attempt.timestamp < oldest_attempt.timestamp):
                oldest_attempt = oldest_user_attempt

        retry_after = 900  # Default 15 minutos em segundos
        if oldest_attempt:
            delta = (oldest_attempt.timestamp + timedelta(minutes=15)) - datetime.utcnow()
            retry_after = max(1, int(delta.total_seconds()))

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login incorretas. Sua conta ou IP foram temporariamente bloqueados. Tente novamente após 15 minutos.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": "5",
                "X-RateLimit-Remaining": "0"
            }
        )

    # Definir cabeçalhos normais de rate limit restante
    max_limit = 5
    remaining = max(0, max_limit - max(failed_attempts_by_ip, failed_attempts_by_user))
    response.headers["X-RateLimit-Limit"] = str(max_limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    user = _resolve_user_for_login(identifier, db)
    if not user:
        attempt = LoginAttempt(ip_address=client_ip, username=identifier, is_successful=False)
        db.add(attempt)
        db.commit()
        audit_logger.log_login(identifier, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciais invalidas",
            headers={
                "X-RateLimit-Limit": str(max_limit),
                "X-RateLimit-Remaining": str(max(0, remaining - 1))
            }
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403, 
            detail="Conta desativada",
            headers={
                "X-RateLimit-Limit": str(max_limit),
                "X-RateLimit-Remaining": str(remaining)
            }
        )

    if not verify_password(password, user.hashed_password):
        attempt = LoginAttempt(ip_address=client_ip, username=user.username, is_successful=False)
        db.add(attempt)
        db.commit()
        audit_logger.log_login(identifier, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciais invalidas",
            headers={
                "X-RateLimit-Limit": str(max_limit),
                "X-RateLimit-Remaining": str(max(0, remaining - 1))
            }
        )

    if user.role == UserRole.PROFESSOR:
        professor = db.query(Professor).filter(Professor.user_id == user.id).first()
        if professor and not str(professor.lyceum_password or "").strip():
            professor.lyceum_password = encrypt_secret(password)

    # Registrar tentativa bem-sucedida
    attempt = LoginAttempt(ip_address=client_ip, username=user.username, is_successful=True)
    db.add(attempt)

    refresh_token = generate_refresh_token()
    session_identifier, access_jti = create_session_payload(user)
    session = create_user_session(
        db=db,
        user=user,
        request=request,
        refresh_token=refresh_token,
        session_identifier=session_identifier,
        access_jti=access_jti,
    )
    access_token = _build_access_token(user, session.session_identifier, access_jti)
    _apply_session_cookies(response, access_token, refresh_token)
    db.commit()

    audit_logger.log_login(user.username, success=True)
    return LoginResponse(
        role=user.role.value,
        username=user.username,
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=LoginResponse)
def refresh_session(request: Request, response: Response, db: Session = Depends(get_db)):
    """Rotaciona refresh token e emite novo access token para a mesma sessao."""
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    session = validate_refresh_session(db, refresh_token)
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or not user.is_active:
        revoke_session(session, "user_inactive")
        db.commit()
        clear_session_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario nao encontrado ou inativo")

    new_refresh_token = generate_refresh_token()
    _, new_access_jti = create_session_payload(user)
    rotate_refresh_session(session, request, new_refresh_token, new_access_jti)
    access_token = _build_access_token(user, session.session_identifier, new_access_jti)
    _apply_session_cookies(response, access_token, new_refresh_token)
    db.commit()

    return LoginResponse(
        role=user.role.value,
        username=user.username,
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Encerra a sessao atual removendo cookies e revogando o refresh token."""
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if refresh_token:
        try:
            session = validate_refresh_session(db, refresh_token)
            revoke_session(session, "manual_logout")
            db.commit()
        except HTTPException:
            db.rollback()
    clear_session_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all_sessions(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoga todas as sessoes do usuario autenticado."""
    revoke_all_user_sessions(db, current_user.id, "logout_all")
    clear_session_cookies(response)
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT


@router.get("/sessions", response_model=List[SessionInfoResponse])
def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista sessoes do usuario autenticado para gestao por dispositivo."""
    current_session_id = None
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if refresh_token:
        try:
            current_session_id = validate_refresh_session(db, refresh_token).session_identifier
        except HTTPException:
            current_session_id = None

    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id)
        .order_by(UserSession.created_at.desc())
        .all()
    )
    return _serialize_sessions(sessions, current_session_id)


@router.delete("/sessions/{session_identifier}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_named_session(
    session_identifier: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoga uma sessao especifica do proprio usuario."""
    session = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == current_user.id,
            UserSession.session_identifier == session_identifier,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    revoke_session(session, "manual_revoke")

    current_refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    current_device_id = get_device_id(request)
    if current_refresh_token:
        try:
            current_session = validate_refresh_session(db, current_refresh_token)
            if current_session.session_identifier == session_identifier:
                clear_session_cookies(response)
        except HTTPException:
            clear_session_cookies(response)
    elif current_device_id and session.device_id == current_device_id:
        clear_session_cookies(response)

    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna dados do usuario autenticado."""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza dados do usuario autenticado."""
    if "full_name" in data:
        full_name = str(data["full_name"] or "").strip()
        if full_name:
            current_user.full_name = full_name

    if "email" in data:
        email = str(data["email"] or "").strip().lower()
        if email and email != current_user.email:
            if db.query(User).filter(User.email == email).first():
                raise HTTPException(status_code=400, detail="E-mail ja cadastrado")
            current_user.email = email

    if "phone" in data:
        phone = str(data["phone"] or "").strip() or None
        if current_user.role == UserRole.PROFESSOR:
            prof = db.query(Professor).filter(Professor.user_id == current_user.id).first()
            if prof:
                prof.phone = phone
        elif current_user.role == UserRole.COORDINATOR:
            coord = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
            if coord:
                coord.phone = phone

    db.commit()
    db.refresh(current_user)
    audit_logger.log_data_change(current_user.username, "User", "UPDATE", current_user.id)
    return current_user


@router.post("/me/lyceum-password", response_model=UserResponse)
def update_my_lyceum_password(
    data: LyceumPasswordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza a senha salva do Lyceum para futuras sincronizacoes do professor."""
    if current_user.role != UserRole.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professores podem atualizar a senha do Lyceum.")

    professor = db.query(Professor).filter(Professor.user_id == current_user.id).first()
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado.")

    portal_result = scraper_service.scrape_professor_portal(current_user.username, data.lyceum_password)
    if not portal_result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=portal_result.get("errors", ["Nao foi possivel validar a nova senha do Lyceum."])[0],
        )

    professor.lyceum_password = encrypt_secret(data.lyceum_password)
    professor.portal_sync_status = "done"
    professor.portal_sync_error = None
    db.commit()
    db.refresh(current_user)

    audit_logger.log_data_change(current_user.username, "ProfessorLyceumPassword", "UPDATE", current_user.id)
    return current_user


@router.post("/me/system-password", response_model=UserResponse)
def update_my_system_password(
    data: SystemPasswordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza somente a senha de acesso do usuario ao NEXORA."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="A senha atual do NEXORA esta incorreta.")

    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="A nova senha do NEXORA deve ser diferente da senha atual.")

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    db.refresh(current_user)

    audit_logger.log_data_change(current_user.username, "UserPassword", "UPDATE", current_user.id)
    return current_user
