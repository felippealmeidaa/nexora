"""
Router administrativo para aprovacao de coordenadores e apoio ao modo em tempo real.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.coordinator import Coordinator
from app.models.coordinator_approval import CoordinatorApproval
from app.models.coordinator_course import CoordinatorCourse
from app.models.user import User, UserRole
from app.models.user_session import UserSession
from app.schemas.coordinator import CoordinatorApprovalCreateRequest
from app.security.rbac import require_role
from app.services.live_data_service import LiveDataService

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/coordinator-approvals")
def list_coordinator_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    approvals = (
        db.query(CoordinatorApproval)
        .order_by(CoordinatorApproval.created_at.desc())
        .all()
    )
    return [
        {
            "id": approval.id,
            "code": approval.code,
            "full_name": approval.full_name,
            "course_names": approval.course_names or [],
            "is_claimed": approval.is_claimed,
            "claimed_user_id": approval.claimed_user_id,
            "created_at": approval.created_at,
        }
        for approval in approvals
    ]


@router.post("/coordinator-approvals", status_code=201)
def create_coordinator_approval(
    data: CoordinatorApprovalCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    existing = db.query(CoordinatorApproval).filter(CoordinatorApproval.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ja existe uma aprovacao cadastrada para este codigo.")

    approval = CoordinatorApproval(
        code=data.code,
        full_name=data.full_name.strip(),
        course_names=data.course_names,
        is_claimed=False,
        created_by_admin_id=current_user.id,
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)

    return {
        "id": approval.id,
        "code": approval.code,
        "full_name": approval.full_name,
        "course_names": approval.course_names or [],
        "is_claimed": approval.is_claimed,
        "claimed_user_id": approval.claimed_user_id,
        "created_at": approval.created_at,
    }


@router.get("/coordinators")
def list_created_coordinators(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    coordinators = (
        db.query(Coordinator, User)
        .join(User, User.id == Coordinator.user_id)
        .order_by(User.full_name.asc())
        .all()
    )
    return [
        {
            "id": coordinator.id,
            "user_id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "academic_course_name": coordinator.academic_course_name,
            "course_names": coordinator.course_names or ([coordinator.academic_course_name] if coordinator.academic_course_name else []),
            "created_at": coordinator.created_at,
        }
        for coordinator, user in coordinators
    ]


@router.delete("/coordinators/{coordinator_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_coordinator_account(
    coordinator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    coordinator = db.query(Coordinator).filter(Coordinator.id == coordinator_id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Coordenador nao encontrado.")

    user = db.query(User).filter(User.id == coordinator.user_id).first()
    approval = db.query(CoordinatorApproval).filter(
        CoordinatorApproval.claimed_user_id == coordinator.user_id
    ).first()

    db.query(CoordinatorCourse).filter(CoordinatorCourse.coordinator_id == coordinator.id).delete(synchronize_session=False)
    db.query(UserSession).filter(UserSession.user_id == coordinator.user_id).delete(synchronize_session=False)

    if approval:
        db.delete(approval)

    db.delete(coordinator)
    if user:
        db.delete(user)

    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/live-courses")
def list_live_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    service = LiveDataService(db)
    return {
        "courses": service.list_available_academic_courses(),
        "professors": service.list_available_professors(),
    }
