from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.users import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return current_user


@router.get("", response_model=list[UserPublic])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    query: str | None = None,
    department_id: int | None = None,
) -> list[UserPublic]:
    q = db.query(User).filter(User.is_active.is_(True))
    if query:
        like = f"%{query.strip()}%"
        q = q.filter((User.first_name.ilike(like)) | (User.last_name.ilike(like)))
    if department_id is not None:
        q = q.filter(User.department_id == department_id)
    return q.order_by(User.last_name.asc(), User.first_name.asc()).limit(200).all()


@router.get("/{user_id}", response_model=UserPublic)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UserPublic:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

