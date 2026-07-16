import math
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, is_manager_user, require_admin
from app.core.config import settings
from app.core.security import hash_password
from app.core.zup import ZupConfigurationError, ZupServiceError, decimal_to_days, fetch_employee_summary
from app.db.session import get_db
from app.models.department import Department
from app.models.gratitude import EmployeeGratitude, EmployeeGratitudeLike
from app.models.notification import Notification
from app.models.user import User
from app.schemas.gratitudes import EmployeeGratitudeCreate, EmployeeGratitudeListPublic, EmployeeGratitudePublic
from app.schemas.users import UpcomingBirthdayPublic, UserCreate, UserPublic, UserUpdate, UserZupSettingsPublic, UserZupSettingsUpdate

router = APIRouter(prefix="/users", tags=["users"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024
ZUP_AUTO_REFRESH_INTERVAL = timedelta(hours=24)
AVATAR_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


@router.get("/me", response_model=UserPublic)
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    return UserPublic.model_validate(current_user).model_copy(update={"is_manager": is_manager_user(db, current_user)})


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


@router.get("/birthdays/upcoming", response_model=list[UpcomingBirthdayPublic])
def list_upcoming_birthdays(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UpcomingBirthdayPublic]:
    today = date.today()
    upcoming: list[UpcomingBirthdayPublic] = []
    users = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            User.access_enabled.is_(True),
            User.iin.is_not(None),
        )
        .all()
    )

    for user in users:
        birth_date = _birth_date_from_iin(user.iin)
        if not birth_date:
            continue
        next_date = _next_birthday(birth_date, today)
        upcoming.append(
            UpcomingBirthdayPublic(
                user=user,
                birth_date=birth_date,
                next_date=next_date,
                days_until=(next_date - today).days,
            )
        )

    return sorted(upcoming, key=lambda item: (item.days_until, item.user.last_name, item.user.first_name))[:5]


@router.get("/{user_id}", response_model=UserPublic)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    user = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .filter(User.id == user_id)
        .first()
    )
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.iin and _can_auto_refresh_zup(current_user, user) and _zup_data_is_stale(user.zup_source_updated_at):
        _try_refresh_user_from_zup(db, user)

    return user


@router.get("/{user_id}/gratitudes", response_model=EmployeeGratitudeListPublic)
def list_user_gratitudes(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = 1,
    page_size: int = 5,
) -> EmployeeGratitudeListPublic:
    _get_active_user(db, user_id)
    page = max(1, page)
    page_size = min(20, max(1, page_size))

    total_count = (
        db.query(func.count(EmployeeGratitude.id))
        .filter(EmployeeGratitude.recipient_id == user_id)
        .scalar()
        or 0
    )
    total_likes = (
        db.query(func.count(EmployeeGratitudeLike.id))
        .join(EmployeeGratitude, EmployeeGratitudeLike.gratitude_id == EmployeeGratitude.id)
        .filter(EmployeeGratitude.recipient_id == user_id)
        .scalar()
        or 0
    )
    gratitudes = (
        db.query(EmployeeGratitude)
        .options(joinedload(EmployeeGratitude.author))
        .filter(EmployeeGratitude.recipient_id == user_id)
        .order_by(EmployeeGratitude.created_at.desc(), EmployeeGratitude.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return EmployeeGratitudeListPublic(
        total_count=total_count,
        total_likes=total_likes,
        page=page,
        page_size=page_size,
        items=_build_gratitude_public(db, gratitudes, current_user.id),
    )


@router.post("/{user_id}/gratitudes", response_model=EmployeeGratitudePublic, status_code=status.HTTP_201_CREATED)
def create_user_gratitude(
    user_id: int,
    payload: EmployeeGratitudeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeGratitudePublic:
    recipient = _get_active_user(db, user_id)
    if recipient.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot thank yourself")

    gratitude = EmployeeGratitude(
        recipient_id=recipient.id,
        author_id=current_user.id,
        content=payload.content.strip(),
    )
    db.add(gratitude)
    db.add(
        Notification(
            recipient_id=recipient.id,
            actor_id=current_user.id,
            title="Новая благодарность",
            body=f"{current_user.first_name} {current_user.last_name} оставил(а) вам благодарность",
            link=f"/users/{recipient.id}",
        )
    )
    db.commit()
    gratitude = (
        db.query(EmployeeGratitude)
        .options(joinedload(EmployeeGratitude.author))
        .filter(EmployeeGratitude.id == gratitude.id)
        .first()
    )
    return _build_gratitude_public(db, [gratitude], current_user.id)[0]


@router.post("/gratitudes/{gratitude_id}/like", response_model=EmployeeGratitudePublic)
def toggle_gratitude_like(
    gratitude_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeGratitudePublic:
    gratitude = (
        db.query(EmployeeGratitude)
        .options(joinedload(EmployeeGratitude.author))
        .filter(EmployeeGratitude.id == gratitude_id)
        .first()
    )
    if not gratitude:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gratitude not found")

    existing = (
        db.query(EmployeeGratitudeLike)
        .filter(EmployeeGratitudeLike.gratitude_id == gratitude.id, EmployeeGratitudeLike.user_id == current_user.id)
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(EmployeeGratitudeLike(gratitude_id=gratitude.id, user_id=current_user.id))
        if gratitude.recipient_id != current_user.id:
            db.add(
                Notification(
                    recipient_id=gratitude.recipient_id,
                    actor_id=current_user.id,
                    title="Лайк благодарности",
                    body=f"{current_user.first_name} {current_user.last_name} оценил(а) благодарность",
                    link=f"/users/{gratitude.recipient_id}",
                )
            )
    db.commit()
    return _build_gratitude_public(db, [gratitude], current_user.id)[0]


@router.get("/{user_id}/zup-settings", response_model=UserZupSettingsPublic)
def get_user_zup_settings(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserZupSettingsPublic:
    _require_own_profile_or_admin(current_user, user_id)
    user = _get_active_user(db, user_id)
    return UserZupSettingsPublic(iin=user.iin)


@router.put("/{user_id}/zup-settings", response_model=UserZupSettingsPublic)
def update_user_zup_settings(
    user_id: int,
    payload: UserZupSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserZupSettingsPublic:
    _require_own_profile_or_admin(current_user, user_id)
    user = _get_active_user(db, user_id)
    new_iin = _clean_optional(payload.iin)
    if new_iin != user.iin:
        user.iin = new_iin
        user.hire_date = None
        user.vacation_days_total = 0
        user.vacation_days_used = 0
        user.vacation_periods = []
        user.zup_last_vacation_info = None
        user.zup_source_updated_at = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserZupSettingsPublic(iin=user.iin)


@router.post("/{user_id}/zup-refresh", response_model=UserPublic)
def refresh_user_from_zup(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    _require_own_profile_or_admin(current_user, user_id)
    user = _get_active_user(db, user_id)
    if not user.iin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee IIN is not configured",
        )

    try:
        _refresh_user_from_zup(db, user)
    except ZupConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ZupServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .filter(User.id == user.id)
        .first()
    )


@router.put("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own profile",
        )

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
    user.work_status = payload.work_status
    user.workday_start = payload.workday_start
    user.workday_end = payload.workday_end
    if current_user.role == "admin":
        user.hire_date = payload.hire_date
        if payload.vacation_days_total is not None:
            user.vacation_days_total = payload.vacation_days_total
        if payload.vacation_days_used is not None:
            user.vacation_days_used = payload.vacation_days_used
    if payload.vacation_periods is not None:
        user.vacation_periods = [period.model_dump(mode="json") for period in payload.vacation_periods]
    if payload.education_records is not None:
        user.education_records = [record.model_dump(mode="json") for record in payload.education_records]
    if payload.additional_education_records is not None:
        user.additional_education_records = [record.model_dump(mode="json") for record in payload.additional_education_records]
    if payload.certificate_records is not None:
        user.certificate_records = [record.model_dump(mode="json") for record in payload.certificate_records]
    if payload.course_records is not None:
        user.course_records = [record.model_dump(mode="json") for record in payload.course_records]
    if payload.skills is not None:
        user.skills = [skill.strip() for skill in payload.skills if skill.strip()]
    if payload.achievement_records is not None:
        user.achievement_records = [record.model_dump(mode="json") for record in payload.achievement_records]

    db.add(user)
    db.commit()
    db.refresh(user)

    return (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.manager))
        .filter(User.id == user.id)
        .first()
    )


@router.post("/{user_id}/avatar", response_model=UserPublic)
async def upload_avatar(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own profile",
        )

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    extension = AVATAR_CONTENT_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload an image file: JPG, PNG, WEBP or GIF",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty")
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Avatar file must be 5 MB or smaller",
        )

    avatar_dir = Path(settings.upload_dir) / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)
    filename = f"user-{user.id}-{uuid4().hex}{extension}"
    (avatar_dir / filename).write_bytes(content)

    public_base = settings.public_upload_url.rstrip("/")
    user.avatar_url = f"{public_base}/avatars/{filename}"
    db.add(user)
    db.commit()

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
    _: User = Depends(require_admin),
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
        work_status=payload.work_status,
        workday_start=payload.workday_start,
        workday_end=payload.workday_end,
        hire_date=payload.hire_date,
        vacation_days_total=payload.vacation_days_total if payload.vacation_days_total is not None else 24,
        vacation_days_used=payload.vacation_days_used if payload.vacation_days_used is not None else 0,
        vacation_periods=[
            period.model_dump(mode="json")
            for period in payload.vacation_periods
        ]
        if payload.vacation_periods
        else [],
        access_enabled=False,
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


def _require_own_profile_or_admin(current_user: User, user_id: int) -> None:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own profile",
        )


def _get_active_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _birth_date_from_iin(iin: str | None) -> date | None:
    if not iin or len(iin) < 6 or not iin[:6].isdigit():
        return None
    yy = int(iin[:2])
    month = int(iin[2:4])
    day = int(iin[4:6])
    current_year_two_digits = date.today().year % 100
    year = 2000 + yy if yy <= current_year_two_digits else 1900 + yy
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _next_birthday(birth_date: date, today: date) -> date:
    try:
        next_date = birth_date.replace(year=today.year)
    except ValueError:
        next_date = date(today.year, 2, 28)
    if next_date < today:
        try:
            next_date = birth_date.replace(year=today.year + 1)
        except ValueError:
            next_date = date(today.year + 1, 2, 28)
    return next_date


def _build_gratitude_public(
    db: Session,
    gratitudes: list[EmployeeGratitude],
    current_user_id: int,
) -> list[EmployeeGratitudePublic]:
    gratitude_ids = [gratitude.id for gratitude in gratitudes]
    if not gratitude_ids:
        return []

    like_rows = (
        db.query(EmployeeGratitudeLike.gratitude_id, func.count(EmployeeGratitudeLike.id))
        .filter(EmployeeGratitudeLike.gratitude_id.in_(gratitude_ids))
        .group_by(EmployeeGratitudeLike.gratitude_id)
        .all()
    )
    liked_rows = (
        db.query(EmployeeGratitudeLike.gratitude_id)
        .filter(
            EmployeeGratitudeLike.gratitude_id.in_(gratitude_ids),
            EmployeeGratitudeLike.user_id == current_user_id,
        )
        .all()
    )
    likes_by_id = {gratitude_id: count for gratitude_id, count in like_rows}
    liked_by_me = {gratitude_id for (gratitude_id,) in liked_rows}

    return [
        EmployeeGratitudePublic(
            id=gratitude.id,
            recipient_id=gratitude.recipient_id,
            author_id=gratitude.author_id,
            author=gratitude.author,
            content=gratitude.content,
            created_at=gratitude.created_at,
            likes_count=likes_by_id.get(gratitude.id, 0),
            liked_by_me=gratitude.id in liked_by_me,
        )
        for gratitude in gratitudes
    ]


def _try_refresh_user_from_zup(db: Session, user: User) -> None:
    try:
        _refresh_user_from_zup(db, user)
    except (ZupConfigurationError, ZupServiceError):
        db.rollback()


def _can_auto_refresh_zup(current_user: User, user: User) -> bool:
    return current_user.id == user.id or current_user.role == "admin"


def _zup_data_is_stale(source_updated_at: datetime | None) -> bool:
    if source_updated_at is None:
        return True
    if source_updated_at.tzinfo is None:
        source_updated_at = source_updated_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - source_updated_at > ZUP_AUTO_REFRESH_INTERVAL


def _refresh_user_from_zup(db: Session, user: User) -> None:
    if not user.iin:
        return

    zup_summary = fetch_employee_summary(user.iin)

    user.hire_date = zup_summary.employment_started_on
    vacation_total = decimal_to_days(zup_summary.vacation_days_total)
    vacation_used = decimal_to_days(zup_summary.vacation_days_used)
    if vacation_total is not None:
        user.vacation_days_total = vacation_total
    if vacation_used is not None:
        user.vacation_days_used = vacation_used
    user.zup_last_vacation_info = zup_summary.last_vacation_info
    user.zup_source_updated_at = zup_summary.source_updated_at
    if _zup_vacation_is_active(user.zup_last_vacation_info):
        user.work_status = "vacation"
    elif user.work_status == "vacation" and user.zup_last_vacation_info:
        user.work_status = "working"

    db.add(user)
    db.commit()
    db.refresh(user)


def _zup_vacation_is_active(value: str | None, today: date | None = None) -> bool:
    if not value:
        return False
    match = re.match(r"^(\d{4}-\d{2}-\d{2})\s+(\d+(?:[.,]\d+)?)$", value.strip())
    if not match:
        return False
    try:
        start = date.fromisoformat(match.group(1))
        days = max(1, math.ceil(float(match.group(2).replace(",", "."))))
    except ValueError:
        return False
    current = today or date.today()
    end = start + timedelta(days=days - 1)
    return start <= current <= end

