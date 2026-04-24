from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.news import NewsPost
from app.models.user import User
from app.schemas.news import NewsPublic
from app.schemas.users import AdminUserUpdate, UserPublic

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserPublic])
def list_admin_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UserPublic]:
    return (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .order_by(User.last_name.asc(), User.first_name.asc())
        .limit(500)
        .all()
    )


@router.patch("/users/{user_id}", response_model=UserPublic)
def update_admin_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> UserPublic:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    if user.id == current_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя отключить собственную учетную запись",
        )

    user.role = payload.role
    user.is_active = payload.is_active
    db.add(user)
    db.commit()
    db.refresh(user)

    return (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .filter(User.id == user.id)
        .first()
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_admin_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя отключить собственную учетную запись",
        )

    user.is_active = False
    db.add(user)
    db.commit()


@router.get("/news", response_model=list[NewsPublic])
def list_admin_news(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[NewsPublic]:
    return (
        db.query(NewsPost)
        .options(joinedload(NewsPost.author))
        .order_by(NewsPost.created_at.desc(), NewsPost.id.desc())
        .limit(500)
        .all()
    )
