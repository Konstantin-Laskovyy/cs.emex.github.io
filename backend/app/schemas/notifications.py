from datetime import datetime

from pydantic import BaseModel


class NotificationPublic(BaseModel):
    id: int
    title: str
    body: str
    link: str | None = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
