from pydantic import BaseModel, Field, HttpUrl


class DepartmentSummary(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ManagerSummary(BaseModel):
    id: int
    first_name: str
    last_name: str
    title: str | None = None
    avatar_url: str | None = None

    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    title: str | None = None
    department_id: int | None = None
    department: DepartmentSummary | None = None
    manager_id: int | None = None
    manager: ManagerSummary | None = None
    avatar_url: str | None = None
    bio: str | None = None
    location: str | None = None
    phone: str | None = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    title: str | None = None
    department_id: int | None = None
    manager_id: int | None = None
    avatar_url: HttpUrl | None = None
    bio: str | None = None
    location: str | None = None
    phone: str | None = None


class UserCreate(UserUpdate):
    email: str
    password: str = Field(min_length=8, default="Password123!")

