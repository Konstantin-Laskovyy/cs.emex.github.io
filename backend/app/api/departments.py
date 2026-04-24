from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.app_setting import AppSetting
from app.models.department import Department
from app.models.user import User
from app.schemas.departments import DepartmentCreate, DepartmentPublic, DepartmentUpdate, OrgRootPublic, OrgRootUpdate

router = APIRouter(prefix="/departments", tags=["departments"])
ORG_ROOT_NAME_KEY = "org_root_name"
ORG_ROOT_MANAGER_ID_KEY = "org_root_manager_id"


@router.get("/org-root", response_model=OrgRootPublic)
def get_org_root(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> OrgRootPublic:
    return _org_root_public(db)


@router.patch("/org-root", response_model=OrgRootPublic)
def update_org_root(
    payload: OrgRootUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> OrgRootPublic:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название верхнего узла обязательно")

    if payload.manager_id is not None:
        manager = db.get(User, payload.manager_id)
        if not manager or not manager.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Руководитель не найден")

    _set_setting(db, ORG_ROOT_NAME_KEY, name)
    _set_setting(db, ORG_ROOT_MANAGER_ID_KEY, str(payload.manager_id) if payload.manager_id else None)
    db.commit()
    return _org_root_public(db)


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
            manager_id=department.manager_id,
            manager=department.manager,
            employee_count=employee_count,
        )
        for department, employee_count in rows
    ]


@router.post("", response_model=DepartmentPublic, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> DepartmentPublic:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название отдела обязательно")

    if db.query(Department).filter(func.lower(Department.name) == name.lower()).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Отдел с таким названием уже существует")

    _validate_department_links(db, parent_id=payload.parent_id, manager_id=payload.manager_id)
    department = Department(name=name, parent_id=payload.parent_id, manager_id=payload.manager_id)
    db.add(department)
    db.commit()
    db.refresh(department)
    return _department_public(db, department)


@router.patch("/{department_id}", response_model=DepartmentPublic)
def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> DepartmentPublic:
    department = db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Отдел не найден")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название отдела обязательно")

    duplicate = (
        db.query(Department)
        .filter(func.lower(Department.name) == name.lower(), Department.id != department_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Отдел с таким названием уже существует")

    if payload.parent_id == department_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Отдел не может быть родителем самому себе")

    _validate_department_links(db, parent_id=payload.parent_id, manager_id=payload.manager_id)

    if payload.parent_id is not None and _is_descendant(db, payload.parent_id, department_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя вложить отдел в собственную ветку")

    department.name = name
    department.parent_id = payload.parent_id
    department.manager_id = payload.manager_id
    db.add(department)
    db.commit()
    db.refresh(department)
    return _department_public(db, department)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    department = db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Отдел не найден")

    child_exists = db.query(Department.id).filter(Department.parent_id == department_id).first()
    if child_exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сначала перенесите дочерние отделы")

    user_exists = db.query(User.id).filter(User.department_id == department_id).first()
    if user_exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сначала перенесите сотрудников из отдела")

    db.delete(department)
    db.commit()


def _validate_department_links(db: Session, parent_id: int | None, manager_id: int | None) -> None:
    if parent_id is not None and not db.get(Department, parent_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Родительский отдел не найден")
    if manager_id is not None:
        manager = db.get(User, manager_id)
        if not manager or not manager.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Руководитель не найден")


def _is_descendant(db: Session, candidate_parent_id: int, department_id: int) -> bool:
    current = db.get(Department, candidate_parent_id)
    while current:
        if current.parent_id == department_id:
            return True
        current = db.get(Department, current.parent_id) if current.parent_id else None
    return False


def _department_public(db: Session, department: Department) -> DepartmentPublic:
    employee_count = (
        db.query(func.count(User.id))
        .filter(User.department_id == department.id, User.is_active.is_(True))
        .scalar()
        or 0
    )
    return DepartmentPublic(
        id=department.id,
        name=department.name,
        parent_id=department.parent_id,
        manager_id=department.manager_id,
        manager=department.manager,
        employee_count=employee_count,
    )


def _get_setting(db: Session, key: str) -> str | None:
    setting = db.get(AppSetting, key)
    return setting.value if setting else None


def _set_setting(db: Session, key: str, value: str | None) -> None:
    setting = db.get(AppSetting, key)
    if not setting:
        setting = AppSetting(key=key)
    setting.value = value
    db.add(setting)


def _org_root_public(db: Session) -> OrgRootPublic:
    name = _get_setting(db, ORG_ROOT_NAME_KEY) or "ТОО «EMEX»"
    manager_id_value = _get_setting(db, ORG_ROOT_MANAGER_ID_KEY)
    manager_id = int(manager_id_value) if manager_id_value else None
    manager = db.get(User, manager_id) if manager_id else None
    return OrgRootPublic(name=name, manager_id=manager_id, manager=manager)

