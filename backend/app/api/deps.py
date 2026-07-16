from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.app_setting import AppSetting
from app.models.department import Department
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
ORG_ROOT_MANAGER_ID_KEY = "org_root_manager_id"


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        if not subject:
            raise credentials_exception
    except JWTError as e:
        raise credentials_exception from e

    user = db.query(User).filter(User.email == subject).first()
    if not user or not user.is_active or not user.access_enabled:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )
    return current_user


def is_manager_user(db: Session, user: User) -> bool:
    if user.role == "admin":
        return True

    manages_department = db.query(Department.id).filter(Department.manager_id == user.id).first()
    if manages_department:
        return True

    has_reports = (
        db.query(User.id)
        .filter(
            User.manager_id == user.id,
            User.is_active.is_(True),
            User.access_enabled.is_(True),
        )
        .first()
    )
    if has_reports:
        return True

    org_root_manager = db.get(AppSetting, ORG_ROOT_MANAGER_ID_KEY)
    return bool(org_root_manager and org_root_manager.value == str(user.id))


def require_manager_or_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    if not is_manager_user(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user

