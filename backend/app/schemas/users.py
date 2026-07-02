from datetime import date, datetime

from pydantic import BaseModel, Field


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


class VacationPeriod(BaseModel):
    start_date: date
    end_date: date
    note: str | None = None


class EducationRecord(BaseModel):
    school: str = ""
    faculty: str = ""
    specialty: str = ""
    graduationYear: str = ""


class AdditionalEducationRecord(BaseModel):
    organization: str = ""
    course: str = ""
    date: str = ""


class CertificateRecord(BaseModel):
    title: str = ""
    organization: str = ""
    issuedAt: str = ""
    validUntil: str | None = None


class CourseRecord(BaseModel):
    title: str = ""
    provider: str = ""
    duration: str = ""
    status: str = ""


class AchievementRecord(BaseModel):
    icon: str = ""
    title: str = ""
    description: str = ""
    date: str = ""


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
    hire_date: date | None = None
    vacation_days_total: int = 24
    vacation_days_used: int = 0
    vacation_periods: list[VacationPeriod] = []
    education_records: list[EducationRecord] = []
    additional_education_records: list[AdditionalEducationRecord] = []
    certificate_records: list[CertificateRecord] = []
    course_records: list[CourseRecord] = []
    skills: list[str] = []
    achievement_records: list[AchievementRecord] = []
    zup_last_vacation_info: str | None = None
    zup_source_updated_at: datetime | None = None
    role: str = "employee"
    is_active: bool = True
    access_enabled: bool = True

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    title: str | None = None
    department_id: int | None = None
    manager_id: int | None = None
    avatar_url: str | None = Field(default=None, max_length=1000)
    bio: str | None = None
    location: str | None = None
    phone: str | None = None
    hire_date: date | None = None
    vacation_days_total: int | None = Field(default=None, ge=0, le=365)
    vacation_days_used: int | None = Field(default=None, ge=0, le=365)
    vacation_periods: list[VacationPeriod] | None = None
    education_records: list[EducationRecord] | None = None
    additional_education_records: list[AdditionalEducationRecord] | None = None
    certificate_records: list[CertificateRecord] | None = None
    course_records: list[CourseRecord] | None = None
    skills: list[str] | None = None
    achievement_records: list[AchievementRecord] | None = None


class UserCreate(UserUpdate):
    email: str
    password: str = Field(min_length=8, default="Password123!")


class AdminUserUpdate(BaseModel):
    role: str = Field(pattern="^(employee|admin)$")
    is_active: bool
    access_enabled: bool = True


class UserZupSettingsPublic(BaseModel):
    iin: str | None = None


class UserZupSettingsUpdate(BaseModel):
    iin: str | None = Field(default=None, pattern=r"^\d{12}$")

