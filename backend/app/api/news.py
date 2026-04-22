from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.news import NewsPost
from app.models.user import User
from app.schemas.news import NewsCreate, NewsPublic, NewsUpdate

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=list[NewsPublic])
def list_news(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[NewsPublic]:
    return (
        db.query(NewsPost)
        .options(joinedload(NewsPost.author))
        .order_by(NewsPost.created_at.desc(), NewsPost.id.desc())
        .limit(100)
        .all()
    )


@router.get("/{news_id}", response_model=NewsPublic)
def get_news(
    news_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> NewsPublic:
    news = (
        db.query(NewsPost)
        .options(joinedload(NewsPost.author))
        .filter(NewsPost.id == news_id)
        .first()
    )
    if not news:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Новость не найдена")
    return news


@router.post("", response_model=NewsPublic, status_code=status.HTTP_201_CREATED)
def create_news(
    payload: NewsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NewsPublic:
    news = NewsPost(
        title=payload.title.strip(),
        summary=payload.summary.strip(),
        content=payload.content.strip(),
        author_id=current_user.id,
    )
    db.add(news)
    db.commit()
    db.refresh(news)

    return (
        db.query(NewsPost)
        .options(joinedload(NewsPost.author))
        .filter(NewsPost.id == news.id)
        .first()
    )


@router.put("/{news_id}", response_model=NewsPublic)
def update_news(
    news_id: int,
    payload: NewsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NewsPublic:
    news = db.get(NewsPost, news_id)
    if not news:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Новость не найдена")
    if news.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Можно редактировать только свои новости",
        )

    news.title = payload.title.strip()
    news.summary = payload.summary.strip()
    news.content = payload.content.strip()

    db.add(news)
    db.commit()
    db.refresh(news)

    return (
        db.query(NewsPost)
        .options(joinedload(NewsPost.author))
        .filter(NewsPost.id == news.id)
        .first()
    )
