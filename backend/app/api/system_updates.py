from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.system_update import SystemUpdate
from app.models.user import User
from app.schemas.system_updates import SystemUpdateCreate, SystemUpdatePublic, SystemUpdateUpdate


router = APIRouter(prefix="/system-updates", tags=["system-updates"])


@router.get("", response_model=list[SystemUpdatePublic])
def list_system_updates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SystemUpdatePublic]:
    return (
        db.query(SystemUpdate)
        .options(joinedload(SystemUpdate.author))
        .order_by(SystemUpdate.created_at.desc(), SystemUpdate.id.desc())
        .limit(100)
        .all()
    )


@router.post("", response_model=SystemUpdatePublic, status_code=status.HTTP_201_CREATED)
def create_system_update(
    payload: SystemUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> SystemUpdatePublic:
    item = SystemUpdate(
        title=payload.title.strip(),
        body=payload.body.strip(),
        author_id=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return (
        db.query(SystemUpdate)
        .options(joinedload(SystemUpdate.author))
        .filter(SystemUpdate.id == item.id)
        .first()
    )


@router.put("/{update_id}", response_model=SystemUpdatePublic)
def update_system_update(
    update_id: int,
    payload: SystemUpdateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> SystemUpdatePublic:
    item = db.get(SystemUpdate, update_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System update not found")

    item.title = payload.title.strip()
    item.body = payload.body.strip()
    db.add(item)
    db.commit()
    db.refresh(item)
    return (
        db.query(SystemUpdate)
        .options(joinedload(SystemUpdate.author))
        .filter(SystemUpdate.id == item.id)
        .first()
    )


@router.delete("/{update_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_system_update(
    update_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    item = db.get(SystemUpdate, update_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System update not found")

    db.delete(item)
    db.commit()
