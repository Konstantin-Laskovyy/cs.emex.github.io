from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatConversationPublic, ChatMessageCreate, ChatMessagePublic

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=list[ChatConversationPublic])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatConversationPublic]:
    messages = (
        db.query(ChatMessage)
        .options(joinedload(ChatMessage.sender), joinedload(ChatMessage.recipient))
        .filter(or_(ChatMessage.sender_id == current_user.id, ChatMessage.recipient_id == current_user.id))
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .all()
    )
    unread_rows = (
        db.query(ChatMessage.sender_id, func.count(ChatMessage.id))
        .filter(ChatMessage.recipient_id == current_user.id, ChatMessage.is_read.is_(False))
        .group_by(ChatMessage.sender_id)
        .all()
    )
    unread_by_user = {sender_id: count for sender_id, count in unread_rows}

    conversations: list[ChatConversationPublic] = []
    seen_user_ids: set[int] = set()
    for message in messages:
        other_user = message.recipient if message.sender_id == current_user.id else message.sender
        if other_user.id in seen_user_ids:
            continue
        seen_user_ids.add(other_user.id)
        conversations.append(
            ChatConversationPublic(
                user=other_user,
                last_message=message,
                unread_count=unread_by_user.get(other_user.id, 0),
            )
        )

    return conversations


@router.get("/conversations/{user_id}/messages", response_model=list[ChatMessagePublic])
def list_messages(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatMessagePublic]:
    other_user = _get_chat_user(db, user_id, current_user)
    messages = (
        db.query(ChatMessage)
        .filter(_conversation_filter(current_user.id, other_user.id))
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .limit(300)
        .all()
    )
    (
        db.query(ChatMessage)
        .filter(
            ChatMessage.sender_id == other_user.id,
            ChatMessage.recipient_id == current_user.id,
            ChatMessage.is_read.is_(False),
        )
        .update({ChatMessage.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return messages


@router.post("/conversations/{user_id}/messages", response_model=ChatMessagePublic, status_code=status.HTTP_201_CREATED)
def create_message(
    user_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessagePublic:
    other_user = _get_chat_user(db, user_id, current_user)
    message = ChatMessage(
        sender_id=current_user.id,
        recipient_id=other_user.id,
        content=payload.content.strip(),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def _get_chat_user(db: Session, user_id: int, current_user: User) -> User:
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot chat with yourself")

    user = db.get(User, user_id)
    if not user or not user.is_active or not user.access_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _conversation_filter(current_user_id: int, other_user_id: int):
    return or_(
        and_(ChatMessage.sender_id == current_user_id, ChatMessage.recipient_id == other_user_id),
        and_(ChatMessage.sender_id == other_user_id, ChatMessage.recipient_id == current_user_id),
    )
