from pydantic import BaseModel


class DepartmentManagerPublic(BaseModel):
    id: int
    first_name: str
    last_name: str
    title: str | None = None
    avatar_url: str | None = None

    class Config:
        from_attributes = True


class DepartmentDocument(BaseModel):
    title: str = ""
    description: str = ""
    url: str = ""


class DepartmentProject(BaseModel):
    title: str = ""
    description: str = ""
    owner: str = ""
    status: str = ""
    dueDate: str = ""


class DepartmentPublic(BaseModel):
    id: int
    name: str
    parent_id: int | None = None
    manager_id: int | None = None
    manager: DepartmentManagerPublic | None = None
    employee_count: int = 0
    description: str | None = None
    documents: list[DepartmentDocument] = []
    projects: list[DepartmentProject] = []

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


class DepartmentContentUpdate(BaseModel):
    description: str | None = None
    documents: list[DepartmentDocument] | None = None
    projects: list[DepartmentProject] | None = None


class OrgRootPublic(BaseModel):
    name: str
    manager_id: int | None = None
    manager: DepartmentManagerPublic | None = None


class OrgRootUpdate(BaseModel):
    name: str
    manager_id: int | None = None

