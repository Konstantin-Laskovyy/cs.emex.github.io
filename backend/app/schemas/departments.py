from pydantic import BaseModel


class DepartmentPublic(BaseModel):
    id: int
    name: str
    parent_id: int | None = None

    class Config:
        from_attributes = True

