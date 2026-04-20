from pydantic import BaseModel


class DepartmentPublic(BaseModel):
    id: int
    name: str
    parent_id: int | None = None
    employee_count: int = 0

    class Config:
        from_attributes = True

