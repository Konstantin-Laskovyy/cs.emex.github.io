from html import escape
from html.parser import HTMLParser
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.config import settings
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
    NewsUploadPublic,
)

router = APIRouter(prefix="/news", tags=["news"])

MAX_NEWS_UPLOAD_SIZE = 20 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/zip": ".zip",
}

ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "figcaption",
    "figure",
    "h2",
    "h3",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "strong",
    "u",
    "ul",
}
VOID_TAGS = {"br", "img"}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "target", "rel"},
    "img": {"src", "alt"},
}


@router.get("", response_model=list[NewsPublic])
def list_news(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[NewsPublic]:
    news_items = (
        db.query(NewsPost)
        .options(joinedload(NewsPost.author))
        .order_by(NewsPost.created_at.desc(), NewsPost.id.desc())
        .limit(100)
        .all()
    )
    for item in news_items:
        item.content = sanitize_news_html(item.content)
    return news_items


@router.post("/uploads", response_model=NewsUploadPublic, status_code=status.HTTP_201_CREATED)
async def upload_news_file(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
) -> NewsUploadPublic:
    content_type = file.content_type or "application/octet-stream"
    extension = ALLOWED_UPLOAD_TYPES.get(content_type)
    if not extension:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    content = await file.read()
    if len(content) > MAX_NEWS_UPLOAD_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large")

    upload_dir = Path(settings.upload_dir) / "news"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    target = upload_dir / filename
    target.write_bytes(content)

    return NewsUploadPublic(
        url=f"{settings.public_upload_url.rstrip('/')}/news/{filename}",
        name=file.filename or filename,
        content_type=content_type,
        is_image=content_type.startswith("image/"),
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
    news.content = sanitize_news_html(news.content)
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
        content=sanitize_news_html(payload.content),
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
    news.content = sanitize_news_html(payload.content)

    db.add(news)
    db.commit()
    db.refresh(news)

    return (
        db.query(NewsPost)
        .options(joinedload(NewsPost.author))
        .filter(NewsPost.id == news.id)
        .first()
    )


class NewsHtmlSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag not in ALLOWED_TAGS:
            return

        safe_attrs = self._safe_attrs(tag, attrs)
        rendered_attrs = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs)
        self.parts.append(f"<{tag}{rendered_attrs}>")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self.parts.append(escape(data))

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")

    def _safe_attrs(self, tag: str, attrs: list[tuple[str, str | None]]) -> list[tuple[str, str]]:
        allowed = ALLOWED_ATTRIBUTES.get(tag, set())
        safe: list[tuple[str, str]] = []
        for name, value in attrs:
            name = name.lower()
            value = (value or "").strip()
            if name not in allowed or name.startswith("on"):
                continue
            if name in {"href", "src"} and not _is_safe_url(value):
                continue
            if tag == "a" and name == "target" and value != "_blank":
                continue
            safe.append((name, value))

        if tag == "a":
            safe = [(name, value) for name, value in safe if name not in {"rel", "target"}]
            if any(name == "href" for name, _ in safe):
                safe.append(("rel", "noopener noreferrer"))
                safe.append(("target", "_blank"))
        return safe

    def get_html(self) -> str:
        return "".join(self.parts).strip()


def sanitize_news_html(value: str) -> str:
    if "<" not in value and ">" not in value:
        lines = [escape(line) for line in value.strip().splitlines()]
        return "<br>".join(lines).strip()

    parser = NewsHtmlSanitizer()
    parser.feed(value.strip())
    parser.close()
    return parser.get_html()


def _is_safe_url(value: str) -> bool:
    lowered = value.lower()
    return (
        lowered.startswith("http://")
        or lowered.startswith("https://")
        or lowered.startswith("mailto:")
        or lowered.startswith(settings.public_upload_url.rstrip("/") + "/")
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
