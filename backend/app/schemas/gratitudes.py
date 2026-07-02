from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.users import ManagerSummary


class EmployeeGratitudeCreate(BaseModel):
    content: str = Field(min_length=3, max_length=2000)


class EmployeeGratitudePublic(BaseModel):
    id: int
    recipient_id: int
    author_id: int
    author: ManagerSummary
    content: str
    created_at: datetime
    likes_count: int = 0
    liked_by_me: bool = False

    class Config:
        from_attributes = True


class EmployeeGratitudeListPublic(BaseModel):
    total_count: int
    total_likes: int
    page: int
    page_size: int
    items: list[EmployeeGratitudePublic]
