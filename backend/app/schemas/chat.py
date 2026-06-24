from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.users import ManagerSummary


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class ChatMessagePublic(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChatConversationPublic(BaseModel):
    user: ManagerSummary
    last_message: ChatMessagePublic | None = None
    unread_count: int = 0
