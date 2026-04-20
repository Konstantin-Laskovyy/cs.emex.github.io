from fastapi import APIRouter, Depends
from sqlalchemy import func
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
    rows = (
        db.query(Department, func.count(User.id))
        .outerjoin(User, (User.department_id == Department.id) & User.is_active.is_(True))
        .group_by(Department.id)
        .order_by(Department.name.asc())
        .all()
    )
    return [
        DepartmentPublic(
            id=department.id,
            name=department.name,
            parent_id=department.parent_id,
            employee_count=employee_count,
        )
        for department, employee_count in rows
    ]

