from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.ad import authenticate_ad_user
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest = Body(...),
    db: Session = Depends(get_db),
) -> TokenResponse:
    if settings.ad_enabled:
        ad_user = authenticate_ad_user(db, payload.email, payload.password)
        if ad_user is not None:
            if not ad_user.is_active:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
            token = create_access_token(subject=ad_user.email)
            return TokenResponse(access_token=token)

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    token = create_access_token(subject=user.email)
    return TokenResponse(access_token=token)

