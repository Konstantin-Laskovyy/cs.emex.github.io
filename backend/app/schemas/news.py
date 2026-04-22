from datetime import datetime

from pydantic import BaseModel, Field


class NewsAuthor(BaseModel):
    id: int
    first_name: str
    last_name: str
    title: str | None = None
    avatar_url: str | None = None

    class Config:
        from_attributes = True


class NewsPublic(BaseModel):
    id: int
    title: str
    summary: str
    content: str
    author_id: int
    author: NewsAuthor
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NewsCreate(BaseModel):
    title: str = Field(min_length=3, max_length=240)
    summary: str = Field(min_length=10, max_length=500)
    content: str = Field(min_length=20)


class NewsUpdate(BaseModel):
    title: str = Field(min_length=3, max_length=240)
    summary: str = Field(min_length=10, max_length=500)
    content: str = Field(min_length=20)
