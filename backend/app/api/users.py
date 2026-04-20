from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models.department import Department
from app.models.user import User
from app.schemas.users import UserCreate, UserPublic, UserUpdate

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
    q = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .filter(User.is_active.is_(True))
    )
    if query:
        like = f"%{query.strip()}%"
        q = q.filter(
            (User.first_name.ilike(like))
            | (User.last_name.ilike(like))
            | (User.email.ilike(like))
            | (User.title.ilike(like))
        )
    if department_id is not None:
        q = q.filter(User.department_id == department_id)
    return q.order_by(User.last_name.asc(), User.first_name.asc()).limit(200).all()


@router.get("/{user_id}", response_model=UserPublic)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UserPublic:
    user = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .filter(User.id == user_id)
        .first()
    )
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UserPublic:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.manager_id is not None:
        if payload.manager_id == user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee cannot manage themselves",
            )

    _validate_links(db, department_id=payload.department_id, manager_id=payload.manager_id)

    user.first_name = payload.first_name.strip()
    user.last_name = payload.last_name.strip()
    user.title = _clean_optional(payload.title)
    user.department_id = payload.department_id
    user.manager_id = payload.manager_id
    user.avatar_url = _clean_optional(str(payload.avatar_url) if payload.avatar_url else None)
    user.bio = _clean_optional(payload.bio)
    user.location = _clean_optional(payload.location)
    user.phone = _clean_optional(payload.phone)

    db.add(user)
    db.commit()
    db.refresh(user)

    return (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .filter(User.id == user.id)
        .first()
    )


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UserPublic:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )

    _validate_links(db, department_id=payload.department_id, manager_id=payload.manager_id)

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        title=_clean_optional(payload.title),
        department_id=payload.department_id,
        manager_id=payload.manager_id,
        avatar_url=_clean_optional(str(payload.avatar_url) if payload.avatar_url else None),
        bio=_clean_optional(payload.bio),
        location=_clean_optional(payload.location),
        phone=_clean_optional(payload.phone),
    )
    db.add(user)
    db.commit()

    return (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .filter(User.email == payload.email)
        .first()
    )


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _validate_links(db: Session, department_id: int | None, manager_id: int | None) -> None:
    if department_id is not None:
        department = db.get(Department, department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department not found",
            )

    if manager_id is not None:
        manager = db.get(User, manager_id)
        if not manager or not manager.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Manager not found",
            )

