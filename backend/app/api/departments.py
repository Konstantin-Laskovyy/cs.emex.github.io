from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.department import Department
from app.models.user import User
from app.schemas.departments import DepartmentPublic

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentPublic])
def list_departments(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DepartmentPublic]:
    return db.query(Department).order_by(Department.name.asc()).all()

