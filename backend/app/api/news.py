from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.news import NewsComment, NewsPost, NewsReaction
from app.models.notification import Notification
from app.models.user import User
from app.schemas.news import (
    NewsCommentCreate,
    NewsCommentPublic,
    NewsCreate,
    NewsPublic,
    NewsReactionSummary,
    NewsReactionToggle,
    NewsUpdate,
)

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


@router.get("/{news_id}/comments", response_model=list[NewsCommentPublic])
def list_comments(
    news_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[NewsCommentPublic]:
    _get_news_or_404(db, news_id)
    return (
        db.query(NewsComment)
        .options(joinedload(NewsComment.author))
        .filter(NewsComment.news_id == news_id)
        .order_by(NewsComment.created_at.asc(), NewsComment.id.asc())
        .all()
    )


@router.post("/{news_id}/comments", response_model=NewsCommentPublic, status_code=status.HTTP_201_CREATED)
def create_comment(
    news_id: int,
    payload: NewsCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NewsCommentPublic:
    news = _get_news_or_404(db, news_id)
    comment = NewsComment(news_id=news_id, author_id=current_user.id, content=payload.content.strip())
    db.add(comment)
    if news.author_id != current_user.id:
        _create_notification(
            db,
            recipient_id=news.author_id,
            actor_id=current_user.id,
            title="Новый комментарий",
            body=f"{current_user.first_name} {current_user.last_name} прокомментировал(а) вашу новость",
            link=f"/news/{news_id}",
        )
    db.commit()
    return (
        db.query(NewsComment)
        .options(joinedload(NewsComment.author))
        .filter(NewsComment.id == comment.id)
        .first()
    )


@router.get("/{news_id}/reactions", response_model=list[NewsReactionSummary])
def list_reactions(
    news_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NewsReactionSummary]:
    _get_news_or_404(db, news_id)
    rows = (
        db.query(NewsReaction.reaction, func.count(NewsReaction.id))
        .filter(NewsReaction.news_id == news_id)
        .group_by(NewsReaction.reaction)
        .all()
    )
    mine = {
        reaction
        for (reaction,) in db.query(NewsReaction.reaction)
        .filter(NewsReaction.news_id == news_id, NewsReaction.user_id == current_user.id)
        .all()
    }
    counts = {reaction: count for reaction, count in rows}
    return [
        NewsReactionSummary(reaction=reaction, count=counts.get(reaction, 0), reacted_by_me=reaction in mine)
        for reaction in ("like", "important", "read")
    ]


@router.post("/{news_id}/reactions", response_model=list[NewsReactionSummary])
def toggle_reaction(
    news_id: int,
    payload: NewsReactionToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NewsReactionSummary]:
    news = _get_news_or_404(db, news_id)
    existing = (
        db.query(NewsReaction)
        .filter(
            NewsReaction.news_id == news_id,
            NewsReaction.user_id == current_user.id,
            NewsReaction.reaction == payload.reaction,
        )
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(NewsReaction(news_id=news_id, user_id=current_user.id, reaction=payload.reaction))
        if news.author_id != current_user.id and payload.reaction != "read":
            _create_notification(
                db,
                recipient_id=news.author_id,
                actor_id=current_user.id,
                title="Новая реакция",
                body=f"{current_user.first_name} {current_user.last_name} отреагировал(а) на вашу новость",
                link=f"/news/{news_id}",
            )
    db.commit()
    return list_reactions(news_id=news_id, db=db, current_user=current_user)


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
    if news.author_id != current_user.id and current_user.role != "admin":
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


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_news(
    news_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    news = db.get(NewsPost, news_id)
    if not news:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Новость не найдена")
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Удалять новости может только администратор",
        )

    db.delete(news)
    db.commit()


def _get_news_or_404(db: Session, news_id: int) -> NewsPost:
    news = db.get(NewsPost, news_id)
    if not news:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Новость не найдена")
    return news


def _create_notification(
    db: Session,
    recipient_id: int,
    actor_id: int | None,
    title: str,
    body: str,
    link: str | None,
) -> None:
    db.add(
        Notification(
            recipient_id=recipient_id,
            actor_id=actor_id,
            title=title,
            body=body,
            link=link,
        )
    )
