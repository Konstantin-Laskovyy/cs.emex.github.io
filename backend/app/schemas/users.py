from pydantic import BaseModel, EmailStr


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    title: str | None = None
    department_id: int | None = None
    avatar_url: str | None = None
    bio: str | None = None
    location: str | None = None
    phone: str | None = None

    class Config:
        from_attributes = True

