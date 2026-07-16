from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.news import NewsAuthor


class SystemUpdatePublic(BaseModel):
    id: int
    title: str
    body: str
    author_id: int
    author: NewsAuthor
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SystemUpdateCreate(BaseModel):
    title: str = Field(min_length=3, max_length=240)
    body: str = Field(min_length=5, max_length=5000)


class SystemUpdateUpdate(SystemUpdateCreate):
    pass
