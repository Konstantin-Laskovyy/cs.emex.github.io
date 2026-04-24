from pydantic import BaseModel


class DepartmentManagerPublic(BaseModel):
    id: int
    first_name: str
    last_name: str
    title: str | None = None
    avatar_url: str | None = None

    class Config:
        from_attributes = True


class DepartmentPublic(BaseModel):
    id: int
    name: str
    parent_id: int | None = None
    manager_id: int | None = None
    manager: DepartmentManagerPublic | None = None
    employee_count: int = 0

    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    name: str
    parent_id: int | None = None
    manager_id: int | None = None


class DepartmentUpdate(BaseModel):
    name: str
    parent_id: int | None = None
    manager_id: int | None = None


class OrgRootPublic(BaseModel):
    name: str
    manager_id: int | None = None
    manager: DepartmentManagerPublic | None = None


class OrgRootUpdate(BaseModel):
    name: str
    manager_id: int | None = None

