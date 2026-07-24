import { createElement, useEffect, useMemo, useState } from "react";
import type { DragEvent, FormEvent, ReactNode } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { useLanguage } from "../i18n";
import { RichTextEditor as VisualRichTextEditor } from "../ui/RichTextEditor";
import type {
  DepartmentPublic,
  EmployeeGratitudeListPublic,
  EmployeeGratitudePublic,
  UserPublic,
  UserUpdate,
  UserZupSettingsPublic,
  WorkStatus,
} from "../api/types";

type ProfileFormState = {
  first_name: string;
  last_name: string;
  title: string;
  department_id: string;
  manager_id: string;
  avatar_url: string;
  bio: string;
  location: string;
  phone: string;
  work_status: WorkStatus;
  workday_start: string;
  workday_end: string;
  hire_date: string;
  vacation_days_total: string;
  vacation_days_used: string;
  vacation_periods_text: string;
  education_records_text: string;
  additional_education_records_text: string;
  certificate_records_text: string;
  course_records_text: string;
  skills_text: string;
  achievement_records: AchievementRecord[];
};

const workStatusOptions: { value: WorkStatus; label: string }[] = [
  { value: "working", label: "На работе" },
  { value: "vacation", label: "В отпуске" },
  { value: "business_trip", label: "Командировка" },
  { value: "sick_leave", label: "Больничный" },
];

type DisplayWorkStatus = WorkStatus | "off_hours";

const workStatusClassName: Record<DisplayWorkStatus, string> = {
  working: "employeeStatusWorking",
  vacation: "employeeStatusVacation",
  business_trip: "employeeStatusBusinessTrip",
  sick_leave: "employeeStatusSickLeave",
  off_hours: "employeeStatusOffHours",
};

function getWorkStatusLabel(status: DisplayWorkStatus | string | undefined) {
  if (status === "off_hours") return "Рабочий день завершен";
  return workStatusOptions.find((item) => item.value === status)?.label ?? "На работе";
}

function parseWorkTime(value: string | null | undefined) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isZupVacationActive(value: string | null | undefined, now: Date) {
  const vacation = parseZupLastVacation(value);
  if (!vacation) return false;
  const days = Math.max(1, Math.ceil(vacation.days));
  const start = new Date(`${vacation.date}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + days - 1);
  const todayKey = toDateKey(now);
  return todayKey >= toDateKey(start) && todayKey <= toDateKey(end);
}

function getEffectiveWorkStatus(user: UserPublic, now: Date): DisplayWorkStatus {
  if (isZupVacationActive(user.zup_last_vacation_info, now)) return "vacation";
  if ((user.work_status ?? "working") !== "working") return user.work_status;
  const end = parseWorkTime(user.workday_end);
  if (end === null) return "working";
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= end ? "off_hours" : "working";
}

function formatWorkSchedule(user: Pick<UserPublic, "workday_start" | "workday_end">) {
  return `${user.workday_start || "09:00"} - ${user.workday_end || "18:00"}`;
}

function getInitials(user: Pick<UserPublic, "first_name" | "last_name">) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

function toFormState(profile: UserPublic): ProfileFormState {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    title: profile.title ?? "",
    department_id: profile.department_id ? String(profile.department_id) : "",
    manager_id: profile.manager_id ? String(profile.manager_id) : "",
    avatar_url: profile.avatar_url ?? "",
    bio: profile.bio ?? "",
    location: profile.location ?? "",
    phone: profile.phone ?? "",
    work_status: profile.work_status ?? "working",
    workday_start: profile.workday_start ?? "09:00",
    workday_end: profile.workday_end ?? "18:00",
    hire_date: profile.hire_date ?? "",
    vacation_days_total: String(profile.vacation_days_total ?? 24),
    vacation_days_used: String(profile.vacation_days_used ?? 0),
    vacation_periods_text: (profile.vacation_periods ?? [])
      .map((period) => `${period.start_date} — ${period.end_date}${period.note ? ` | ${period.note}` : ""}`)
      .join("\n"),
    education_records_text: (profile.education_records ?? [])
      .map((item) => [item.school, item.faculty, item.specialty, item.graduationYear].join(" | "))
      .join("\n"),
    additional_education_records_text: (profile.additional_education_records ?? [])
      .map((item) => [item.organization, item.course, item.date].join(" | "))
      .join("\n"),
    certificate_records_text: (profile.certificate_records ?? [])
      .map((item) => [item.title, item.organization, item.issuedAt, item.validUntil ?? ""].join(" | "))
      .join("\n"),
    course_records_text: (profile.course_records ?? [])
      .map((item) => [item.title, item.provider, item.duration, item.status].join(" | "))
      .join("\n"),
    skills_text: (profile.skills ?? []).join("\n"),
    achievement_records: (profile.achievement_records ?? []).map((item) => ({
      icon: item.icon ?? "",
      title: item.title ?? "",
      description: item.description ?? "",
      date: item.date ?? "",
    })),
  };
}

function parseVacationPeriods(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [range, note] = line.split("|").map((part) => part.trim());
      const [start_date, end_date] = range.split(/\s+—\s+|\s+-\s+|\s+по\s+/i).map((part) => part.trim());
      return {
        start_date,
        end_date: end_date || start_date,
        note: note || null,
      };
    })
    .filter((period) => period.start_date && period.end_date);
}

function splitProfileLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((part) => part.trim()));
}

function parseEducationRecords(value: string): EducationRecord[] {
  return splitProfileLines(value)
    .map(([school, faculty, specialty, graduationYear]) => ({ school, faculty, specialty, graduationYear }))
    .filter((item) => item.school || item.faculty || item.specialty || item.graduationYear);
}

function parseAdditionalEducationRecords(value: string): AdditionalEducationRecord[] {
  return splitProfileLines(value)
    .map(([organization, course, date]) => ({ organization, course, date }))
    .filter((item) => item.organization || item.course || item.date);
}

function parseCertificateRecords(value: string): CertificateRecord[] {
  return splitProfileLines(value)
    .map(([title, organization, issuedAt, validUntil]) => ({ title, organization, issuedAt, validUntil: validUntil || null }))
    .filter((item) => item.title || item.organization || item.issuedAt || item.validUntil);
}

function parseCourseRecords(value: string): CourseRecord[] {
  return splitProfileLines(value)
    .map(([title, provider, duration, status]) => ({ title, provider, duration, status }))
    .filter((item) => item.title || item.provider || item.duration || item.status);
}

function parseSkills(value: string) {
  return value
    .split(/\n|,/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function formatRuDate(value?: string | null) {
  if (!value) return "Не указано";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatNewsDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatVacationDays(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} дня`;
  return `${value} дней`;
}

function parseZupLastVacation(value?: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  return {
    date: match[1],
    days: Number(match[2].replace(",", ".")),
  };
}

function getWorkDuration(hireDate?: string | null) {
  if (!hireDate) return "Дата приема не указана";
  const start = new Date(`${hireDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "Дата приема не указана";
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const yearText = years ? `${years} г.` : "";
  const monthText = months ? `${months} мес.` : "";
  return [yearText, monthText].filter(Boolean).join(" ") || "Меньше месяца";
}

type OutletContext = {
  me: UserPublic | null;
};

type ProfileTab = "general" | "education" | "achievements" | "gratitude";

const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: "general", label: "Общая информация" },
  { id: "education", label: "Образование и развитие" },
  { id: "achievements", label: "Достижения" },
  { id: "gratitude", label: "Благодарности" },
];

type EducationRecord = {
  school: string;
  faculty: string;
  specialty: string;
  graduationYear: string;
};

type AdditionalEducationRecord = {
  organization: string;
  course: string;
  date: string;
};

type CertificateRecord = {
  title: string;
  organization: string;
  issuedAt: string;
  validUntil?: string | null;
};

type CourseRecord = {
  title: string;
  provider: string;
  duration: string;
  status: string;
};

type AchievementRecord = {
  icon: string;
  title: string;
  description: string;
  date: string;
};

export function UserProfilePage() {
  const { t } = useLanguage();
  const { id } = useParams();
  const { me } = useOutletContext<OutletContext>();
  const userId = useMemo(() => (id ? Number(id) : NaN), [id]);

  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [employees, setEmployees] = useState<UserPublic[]>([]);
  const [zupIin, setZupIin] = useState("");
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [zupSaving, setZupSaving] = useState(false);
  const [zupRefreshing, setZupRefreshing] = useState(false);
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("general");
  const [activeEditTab, setActiveEditTab] = useState<ProfileTab>("general");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setProfile(null);
    setZupIin("");
    setForm(null);
    setIsEditing(false);
    setActiveTab("general");
    setActiveEditTab("general");

    if (!Number.isFinite(userId)) {
      setLoading(false);
      setLoadError("Некорректный id сотрудника.");
      return;
    }

    const canLoadZupSettings = Boolean(me && (me.id === userId || me.role === "admin"));

    Promise.all([
      apiFetch<UserPublic>(`/users/${userId}`),
      apiFetch<DepartmentPublic[]>("/departments"),
      apiFetch<UserPublic[]>("/users"),
      canLoadZupSettings
        ? apiFetch<UserZupSettingsPublic>(`/users/${userId}/zup-settings`).catch(() => ({ iin: "" }))
        : Promise.resolve(null),
    ])
      .then(([profileData, departmentsData, employeesData, zupSettingsData]) => {
        if (cancelled) return;
        setProfile(profileData);
        setDepartments(departmentsData);
        setEmployees(employeesData);
        setZupIin(zupSettingsData?.iin ?? "");
        setForm(toFormState(profileData));
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setLoadError("Нужно войти, чтобы видеть карточку сотрудника.");
        } else if (error instanceof ApiError && error.status === 404) {
          setLoadError("Сотрудник не найден.");
        } else {
          setLoadError(error?.message || "Ошибка загрузки.");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, me?.id, me?.role]);

  async function handleSaveZupSettings() {
    if (!profile) return;
    setZupSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const updated = await apiFetch<UserZupSettingsPublic>(`/users/${profile.id}/zup-settings`, {
        method: "PUT",
        body: JSON.stringify({ iin: zupIin.trim() || null }),
      });
      setZupIin(updated.iin ?? "");
      setSaveMessage("Настройки 1С ЗУП сохранены.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить настройки 1С ЗУП.");
    } finally {
      setZupSaving(false);
    }
  }

  async function handleRefreshZupData() {
    if (!profile) return;
    setZupRefreshing(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const updated = await apiFetch<UserPublic>(`/users/${profile.id}/zup-refresh`, {
        method: "POST",
      });
      setProfile(updated);
      setForm(toFormState(updated));
      setSaveMessage("Данные из 1С ЗУП загружены в базу.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось загрузить данные из 1С ЗУП.");
    } finally {
      setZupRefreshing(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !profile) return;

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    const payload: UserUpdate = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      title: form.title.trim() || null,
      department_id: form.department_id ? Number(form.department_id) : null,
      manager_id: form.manager_id ? Number(form.manager_id) : null,
      avatar_url: form.avatar_url.trim() || null,
      bio: form.bio.trim() || null,
      location: form.location.trim() || null,
      phone: form.phone.trim() || null,
      work_status: form.work_status,
      workday_start: form.workday_start,
      workday_end: form.workday_end,
      education_records: parseEducationRecords(form.education_records_text),
      additional_education_records: parseAdditionalEducationRecords(form.additional_education_records_text),
      certificate_records: parseCertificateRecords(form.certificate_records_text),
      course_records: parseCourseRecords(form.course_records_text),
      skills: parseSkills(form.skills_text),
      achievement_records: form.achievement_records
        .map((item) => ({
          icon: item.icon.trim(),
          title: item.title.trim(),
          description: item.description.trim(),
          date: item.date.trim(),
        }))
        .filter((item) => item.icon || item.title || item.description || item.date),
    };
    if (me?.role === "admin") {
      payload.hire_date = form.hire_date || null;
      payload.vacation_days_total = Number(form.vacation_days_total || 0);
      payload.vacation_days_used = Number(form.vacation_days_used || 0);
      payload.vacation_periods = parseVacationPeriods(form.vacation_periods_text);
    }

    try {
      const updated = await apiFetch<UserPublic>(`/users/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setProfile(updated);
      setForm(toFormState(updated));
      setIsEditing(false);
      setSaveMessage("Мой профиль обновлен.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить изменения.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarFile(file: File | undefined) {
    if (!file || !profile || !form) return;

    setSaveMessage(null);
    setSaveError(null);

    if (!file.type.startsWith("image/")) {
      setSaveError("Выберите файл изображения.");
      return;
    }

    const data = new FormData();
    data.append("file", file);

    try {
      setAvatarUploading(true);
      const updated = await apiFetch<UserPublic>(`/users/${profile.id}/avatar`, {
        method: "POST",
        body: data,
      });
      setProfile(updated);
      setForm(toFormState(updated));
      setSaveMessage("Фото профиля обновлено.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось загрузить фото.");
    } finally {
      setAvatarUploading(false);
      setAvatarDragActive(false);
    }
  }

  function handleAvatarDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    void handleAvatarFile(event.dataTransfer.files[0]);
  }

  if (loading) {
    return (
      <section className="card">
        <div className="cardInner" style={{ padding: 18 }}>
          <div className="muted">{t("common.loading")}</div>
        </div>
      </section>
    );
  }

  if (loadError || !profile || !form) {
    return (
      <section className="card pageHero">
        <div className="cardInner">
          <h1 style={{ margin: 0 }}>{loadError ?? "Сотрудник не найден"}</h1>
          <div className="muted" style={{ marginTop: 8 }}>
            Попробуйте открыть карточку из списка сотрудников.
          </div>
          <div style={{ marginTop: 14 }} className="row">
            <Link className="btn" to="/users">
              ← {t("common.backList")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const isOwnProfile = me?.id === profile.id;
  const canEditProfile = isOwnProfile || me?.role === "admin";
  const canViewDashboard = isOwnProfile || me?.role === "admin";
  const canEditHr = me?.role === "admin";
  const canManageZup = canEditProfile;
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const managerOptions = employees.filter((employee) => employee.id !== profile.id);
  const reports = employees.filter((employee) => employee.manager_id === profile.id);
  const vacationRemaining = Math.max(0, (profile.vacation_days_total ?? 0) - (profile.vacation_days_used ?? 0));
  const zupLastVacation = parseZupLastVacation(profile.zup_last_vacation_info);
  const effectiveWorkStatus = getEffectiveWorkStatus(profile, now);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!isEditing && (
        <section className="card">
          <div className={`cardInner ${canViewDashboard ? "profileCardInner" : ""}`}>
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            {profile.avatar_url ? (
              <button
                className="avatar avatarLarge avatarPreviewButton"
                type="button"
                onClick={() => setAvatarPreviewUrl(profile.avatar_url ?? null)}
                aria-label="Открыть фото сотрудника"
              >
                <img src={profile.avatar_url} alt={fullName} className="avatarImage" />
              </button>
            ) : (
              <div className="avatar avatarLarge">
                <span>{getInitials(profile)}</span>
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0 }}>{fullName}</h1>
              <div className="muted" style={{ marginTop: 6 }}>
                {profile.title ?? t("users.noPosition")}
              </div>
              <div
                className={`employeeStatusBadge ${workStatusClassName[effectiveWorkStatus]}`}
                style={{ marginTop: 8 }}
              >
                {getWorkStatusLabel(effectiveWorkStatus)}
              </div>
              <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
                График работы: {formatWorkSchedule(profile)}
              </div>
              <div className="muted" style={{ fontSize: 14, marginTop: 8 }}>
                Отдел: {profile.department?.name ?? "не назначен"}
              </div>
              <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                Руководитель:{" "}
                {profile.manager
                  ? `${profile.manager.first_name} ${profile.manager.last_name}`
                  : "не назначен"}
              </div>
            </div>

            <div className="spacer" />
            {!isOwnProfile && profile.access_enabled && (
              <Link className="btn btnPrimary" to={`/chat?user=${profile.id}`}>
                Написать сотруднику
              </Link>
            )}
            {canEditProfile && !isEditing && (
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => {
                  setForm(toFormState(profile));
                  setSaveError(null);
                  setSaveMessage(null);
                  setActiveEditTab("general");
                  setIsEditing(true);
                }}
              >
                {t("common.edit")}
              </button>
            )}
            <Link className="btn" to="/users">
              ← {t("common.backList")}
            </Link>
          </div>

          <div className="profileTabs" role="tablist" aria-label="Разделы профиля">
            {profileTabs.map((tab) => (
              <button
                key={tab.id}
                className={`profileTab ${activeTab === tab.id ? "profileTabActive" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="profileTabPanel" role="tabpanel">
            {activeTab === "general" && (
              <ProfileGeneralTab profile={profile} reports={reports} />
            )}
            {activeTab === "education" && <EducationDevelopmentTab profile={profile} />}
            {activeTab === "achievements" && <AchievementsTab achievements={profile.achievement_records ?? []} />}
            {activeTab === "gratitude" && <GratitudeTab profileId={profile.id} currentUserId={me?.id ?? null} />}
          </div>

          {canViewDashboard && (
            <div className="employeeDashboard">
              <div className="employeeDashboardHeader">
                <div>
                  <span className="newsBadge">Личный дашборд</span>
                  <h2>Работа и отпуск</h2>
                </div>
                <p>
                  {profile.zup_source_updated_at
                    ? `Данные из 1С обновлены: ${new Date(profile.zup_source_updated_at).toLocaleString()}`
                    : "Ключевые HR-данные сотрудника в одном месте."}
                </p>
              </div>
              <div className="employeeDashboardGrid">
                <div className="employeeDashboardCard">
                  <span>Принят на работу</span>
                  <strong>{formatRuDate(profile.hire_date)}</strong>
                </div>
                <div className="employeeDashboardCard">
                  <span>Стаж в компании</span>
                  <strong>{getWorkDuration(profile.hire_date)}</strong>
                </div>
                <div className="employeeDashboardCard">
                  <span>Отпуск доступно</span>
                  <strong>{vacationRemaining} дн.</strong>
                  <small>
                    Всего {profile.vacation_days_total ?? 0}, использовано {profile.vacation_days_used ?? 0}
                  </small>
                </div>
              </div>
              <div className="vacationTimeline">
                <div className="vacationTimelineTitle">История отпусков</div>
                {profile.zup_last_vacation_info && (
                  <div className="vacationTimelineItem">
                    <b>Последний отпуск из 1С</b>
                    {zupLastVacation ? (
                      <span>
                        с {formatRuDate(zupLastVacation.date)}, {formatVacationDays(zupLastVacation.days)}
                      </span>
                    ) : (
                      <span>{profile.zup_last_vacation_info}</span>
                    )}
                  </div>
                )}
                {profile.vacation_periods?.length ? (
                  profile.vacation_periods.map((period, index) => (
                    <div className="vacationTimelineItem" key={`${period.start_date}-${period.end_date}-${index}`}>
                      <b>
                        {formatRuDate(period.start_date)} — {formatRuDate(period.end_date)}
                      </b>
                      <span>{period.note || "Отпуск"}</span>
                    </div>
                  ))
                ) : (
                  <div className="muted">История отпусков пока не заполнена.</div>
                )}
              </div>
            </div>
          )}

          </div>
        </section>
      )}

      {canEditProfile && isEditing ? (
        <section className="card">
          <div className="cardInner">
            <div className="row" style={{ alignItems: "baseline" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>{t("top.myProfile")}</h2>
                <div className="muted" style={{ marginTop: 6 }}>
                  Только владелец профиля может менять свои данные.
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <div className="profileTabs" role="tablist" aria-label="Разделы редактирования профиля">
                {profileTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`profileTab ${activeEditTab === tab.id ? "profileTabActive" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeEditTab === tab.id}
                    onClick={() => setActiveEditTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeEditTab === "general" && (
                <>
              <div
                className={`avatarDropzone ${avatarDragActive ? "avatarDropzoneActive" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setAvatarDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setAvatarDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setAvatarDragActive(false);
                }}
                onDrop={handleAvatarDrop}
              >
                <div className="avatar avatarLarge avatarRound">
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt={fullName} className="avatarImage" />
                  ) : (
                    <span>{getInitials(profile)}</span>
                  )}
                </div>
                <div className="avatarDropzoneText">
                  <strong>Фото сотрудника</strong>
                  <span>Перетащите изображение сюда или выберите файл с компьютера.</span>
                  <span className="muted">JPG, PNG, WEBP или GIF до 5 МБ.</span>
                </div>
                <input
                  id="avatar-upload"
                  className="avatarUploadInput"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    void handleAvatarFile(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <label className="btn btnPrimary" htmlFor="avatar-upload">
                  {avatarUploading ? t("common.loading") : "Выбрать фото"}
                </label>
              </div>

              <div className="formGrid">
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.firstName")}</div>
                  <input className="input" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.lastName")}</div>
                  <input className="input" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.position")}</div>
                  <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.department")}</div>
                  <select className="input" value={form.department_id} onChange={(event) => setForm({ ...form, department_id: event.target.value })}>
                    <option value="">Не выбран</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.manager")}</div>
                  <select className="input" value={form.manager_id} onChange={(event) => setForm({ ...form, manager_id: event.target.value })}>
                    <option value="">Не назначен</option>
                    {managerOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.location")}</div>
                  <input className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.phone")}</div>
                  <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Статус</div>
                  <select
                    className="input"
                    value={form.work_status}
                    onChange={(event) => setForm({ ...form, work_status: event.target.value as WorkStatus })}
                  >
                    {workStatusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Начало рабочего дня</div>
                  <input
                    className="input"
                    type="time"
                    value={form.workday_start}
                    onChange={(event) => setForm({ ...form, workday_start: event.target.value })}
                  />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Конец рабочего дня</div>
                  <input
                    className="input"
                    type="time"
                    value={form.workday_end}
                    onChange={(event) => setForm({ ...form, workday_end: event.target.value })}
                  />
                </label>
              </div>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.description")}</div>
                <RichTextEditor value={form.bio} onChange={(bio) => setForm({ ...form, bio })} />
              </label>

              {canManageZup && (
                <div className="hrEditPanel">
                  <div>
                    <h3>1С ЗУП</h3>
                    <p>ИИН скрыт в карточке. Данные загружаются из 1С в базу и после этого быстро отображаются в профиле.</p>
                  </div>
                  <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
                    <label style={{ minWidth: 220, flex: "1 1 220px" }}>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>ИИН для запроса в 1С</div>
                      <input
                        className="input"
                        value={zupIin}
                        maxLength={12}
                        inputMode="numeric"
                        onChange={(event) => setZupIin(event.target.value.replace(/\D/g, "").slice(0, 12))}
                      />
                    </label>
                    <button className="btn" type="button" onClick={handleSaveZupSettings} disabled={zupSaving || (zupIin.length > 0 && zupIin.length !== 12)}>
                      {zupSaving ? "Сохраняем..." : "Сохранить ИИН"}
                    </button>
                    <button className="btn btnPrimary" type="button" onClick={handleRefreshZupData} disabled={zupRefreshing || zupIin.length !== 12}>
                      {zupRefreshing ? "Загружаем..." : "Загрузить из 1С"}
                    </button>
                  </div>
                </div>
              )}

              {canEditHr && (
                <div className="hrEditPanel">
                  <div>
                    <h3>HR-данные сотрудника</h3>
                    <p>Эти поля видит сотрудник в личном дашборде, но редактирует только администратор.</p>
                  </div>
                  <div className="formGrid">
                    <label>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Дата приема</div>
                      <input
                        className="input"
                        type="date"
                        value={form.hire_date}
                        onChange={(event) => setForm({ ...form, hire_date: event.target.value })}
                      />
                    </label>
                    <label>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Дней отпуска всего</div>
                      <input
                        className="input"
                        min="0"
                        type="number"
                        value={form.vacation_days_total}
                        onChange={(event) => setForm({ ...form, vacation_days_total: event.target.value })}
                      />
                    </label>
                    <label>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Использовано дней</div>
                      <input
                        className="input"
                        min="0"
                        type="number"
                        value={form.vacation_days_used}
                        onChange={(event) => setForm({ ...form, vacation_days_used: event.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>История отпусков</div>
                    <textarea
                      className="input"
                      rows={4}
                      placeholder="2026-07-01 — 2026-07-14 | Ежегодный отпуск"
                      value={form.vacation_periods_text}
                      onChange={(event) => setForm({ ...form, vacation_periods_text: event.target.value })}
                    />
                  </label>
                </div>
              )}

                </>
              )}

              {activeEditTab === "education" && (
                <div className="profileSectionGrid">
                  <ProfileEditTextarea
                    label="Высшее образование"
                    hint="Формат: учебное заведение | факультет | специальность | год окончания"
                    rows={4}
                    value={form.education_records_text}
                    onChange={(value) => setForm({ ...form, education_records_text: value })}
                  />
                  <ProfileEditTextarea
                    label="Дополнительное образование"
                    hint="Формат: организация | название курса | дата"
                    rows={4}
                    value={form.additional_education_records_text}
                    onChange={(value) => setForm({ ...form, additional_education_records_text: value })}
                  />
                  <ProfileEditTextarea
                    label="Сертификаты"
                    hint="Формат: название | организация | дата получения | срок действия"
                    rows={4}
                    value={form.certificate_records_text}
                    onChange={(value) => setForm({ ...form, certificate_records_text: value })}
                  />
                  <ProfileEditTextarea
                    label="Курсы"
                    hint="Формат: название курса | провайдер | продолжительность | статус"
                    rows={4}
                    value={form.course_records_text}
                    onChange={(value) => setForm({ ...form, course_records_text: value })}
                  />
                  <ProfileEditTextarea
                    label="Навыки"
                    hint="Каждый навык с новой строки или через запятую"
                    rows={4}
                    value={form.skills_text}
                    onChange={(value) => setForm({ ...form, skills_text: value })}
                  />
                </div>
              )}

              {activeEditTab === "achievements" && (
                <AchievementRecordsEditor
                  items={form.achievement_records}
                  onChange={(achievement_records) => setForm({ ...form, achievement_records })}
                />
              )}

              {activeEditTab === "gratitude" && (
                <ProfileEmptyState>
                  Благодарности оставляют другие сотрудники во вкладке просмотра профиля. Их нельзя редактировать из карточки сотрудника.
                </ProfileEmptyState>
              )}

              {saveMessage && <div style={{ color: "#bfdbfe" }}>{saveMessage}</div>}
              {saveError && <div style={{ color: "#fecaca" }}>{saveError}</div>}

              <div className="row">
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setForm(toFormState(profile));
                    setSaveError(null);
                    setSaveMessage(null);
                    setIsEditing(false);
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button className="btn btnPrimary" type="submit" disabled={saving}>
                  {saving ? `${t("common.saveChanges")}...` : t("common.saveChanges")}
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : !canEditProfile ? (
        <section className="card">
          <div className="cardInner">
            <h2 style={{ margin: 0, fontSize: 22 }}>Профиль только для просмотра</h2>
            <div className="muted" style={{ marginTop: 10 }}>
              Редактировать можно только свой профиль. Для изменения чужих данных обратитесь к владельцу профиля или администратору.
            </div>
          </div>
        </section>
      ) : null}

      {avatarPreviewUrl && (
        <div className="avatarPreviewOverlay" role="dialog" aria-modal="true" onClick={() => setAvatarPreviewUrl(null)}>
          <div className="avatarPreviewDialog" onClick={(event) => event.stopPropagation()}>
            <button className="avatarPreviewClose" type="button" onClick={() => setAvatarPreviewUrl(null)} aria-label="Закрыть фото">
              x
            </button>
            <img src={avatarPreviewUrl} alt={fullName} />
          </div>
        </div>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Расскажите о сотруднике, его задачах и опыте...",
  maxLength = 2000,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <VisualRichTextEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      allowUploads={false}
    />
  );
}

type ProfileBioBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: Array<{ text: string; children: string[] }> };

function renderProfileInlineText(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*.+?\*\*|\+\+.+?\+\+|\*.+?\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("++") && part.endsWith("++")) {
      return <u key={key}>{part.slice(2, -2)}</u>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function parseProfileBio(value: string): ProfileBioBlock[] {
  const blocks: ProfileBioBlock[] = [];
  let listItems: Array<{ text: string; children: string[] }> = [];
  let listIsOrdered = false;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", ordered: listIsOrdered, items: listItems });
      listItems = [];
    }
  };

  value.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }

    const nestedItem = line.match(/^[oо]\s+(.+)$/i);
    if (nestedItem && listItems.length > 0) {
      listItems[listItems.length - 1].children.push(nestedItem[1]);
      return;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push({ type: "heading", level: heading[1].length as 2 | 3, text: heading[2] });
      return;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushList();
      blocks.push({ type: "quote", text: quote[1] });
      return;
    }

    const listItem = line.match(/^(\d+[.)]|[•●▪◦\-–—])\s*(.+)$/);
    if (listItem) {
      const itemIsOrdered = /^\d/.test(listItem[1]);
      if (listItems.length > 0 && itemIsOrdered !== listIsOrdered) {
        flushList();
      }
      listIsOrdered = itemIsOrdered;
      listItems.push({ text: listItem[2], children: [] });
      return;
    }

    flushList();
    blocks.push({ type: "paragraph", text: line });
  });

  flushList();
  return blocks;
}

const safeRichTextTags = new Set([
  "a", "blockquote", "br", "code", "em", "h1", "h2", "h3", "hr",
  "li", "ol", "p", "pre", "s", "span", "strong", "u", "ul",
]);
const safeRichTextFonts = new Set(["Arial", "Georgia", "Verdana", "Times New Roman", "Courier New"]);
const safeRichTextSizes = new Set(["12px", "14px", "16px", "18px", "24px", "32px"]);
const safeRichTextLineHeights = new Set(["1", "1.25", "1.5", "1.75", "2"]);
const safeRichTextAlignments = new Set(["left", "center", "right", "justify"]);
const safeRichTextColor = /^(?:#[0-9a-f]{3}(?:[0-9a-f]{3}|[0-9a-f]{5})?|rgba?\(\s*\d{1,3}(?:\s*,\s*\d{1,3}){2}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;

function renderSafeRichTextHtml(value: string): ReactNode[] {
  const documentValue = new DOMParser().parseFromString(value, "text/html");

  const renderNode = (node: Node, key: string): ReactNode => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return null;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes).map((child, index) => renderNode(child, `${key}-${index}`));
    if (!safeRichTextTags.has(tag)) return children;

    const props: Record<string, unknown> = { key };
    const style: Record<string, string | number> = {};

    if (tag === "a") {
      const href = element.getAttribute("href")?.trim() || "";
      if (/^(https?:|mailto:|tel:|\/(?!\/))/i.test(href)) {
        props.href = href;
        props.target = "_blank";
        props.rel = "noopener noreferrer";
      }
    }

    const indent = Number(element.getAttribute("data-indent") || 0);
    if (Number.isInteger(indent) && indent >= 1 && indent <= 4) {
      style.marginLeft = `${indent * 24}px`;
    }

    const textAlign = element.style.textAlign;
    if (safeRichTextAlignments.has(textAlign)) style.textAlign = textAlign;
    const fontFamily = element.style.fontFamily.replace(/^["']|["']$/g, "");
    if (safeRichTextFonts.has(fontFamily)) style.fontFamily = fontFamily;
    if (safeRichTextSizes.has(element.style.fontSize)) style.fontSize = element.style.fontSize;
    if (safeRichTextLineHeights.has(element.style.lineHeight)) style.lineHeight = element.style.lineHeight;
    if (safeRichTextColor.test(element.style.color)) style.color = element.style.color;
    if (safeRichTextColor.test(element.style.backgroundColor)) style.backgroundColor = element.style.backgroundColor;
    if (Object.keys(style).length) props.style = style;

    if (tag === "br" || tag === "hr") return createElement(tag, props);
    return createElement(tag, props, children);
  };

  return Array.from(documentValue.body.childNodes).map((node, index) => renderNode(node, `html-${index}`));
}

export function RichTextContent({
  value,
  emptyText = "Описание пока не заполнено.",
}: {
  value: string | null | undefined;
  emptyText?: string;
}) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return <div className="profileAboutEmpty">{emptyText}</div>;
  }

  if (/<\/?[a-z][\s\S]*>/i.test(normalizedValue)) {
    return <div className="profileAboutContent">{renderSafeRichTextHtml(normalizedValue)}</div>;
  }

  return (
    <div className="profileAboutContent">
      {parseProfileBio(normalizedValue).map((block, blockIndex) => {
        if (block.type === "paragraph") {
          return <p key={`paragraph-${blockIndex}`}>{renderProfileInlineText(block.text, `paragraph-${blockIndex}`)}</p>;
        }
        if (block.type === "heading") {
          return block.level === 2
            ? <h2 key={`heading-${blockIndex}`}>{renderProfileInlineText(block.text, `heading-${blockIndex}`)}</h2>
            : <h3 key={`heading-${blockIndex}`}>{renderProfileInlineText(block.text, `heading-${blockIndex}`)}</h3>;
        }
        if (block.type === "quote") {
          return <blockquote key={`quote-${blockIndex}`}>{renderProfileInlineText(block.text, `quote-${blockIndex}`)}</blockquote>;
        }

        const ListTag = block.ordered ? "ol" : "ul";
        return (
          <ListTag key={`list-${blockIndex}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`${item.text}-${itemIndex}`}>
                <span>{renderProfileInlineText(item.text, `list-${blockIndex}-${itemIndex}`)}</span>
                {item.children.length > 0 && (
                  <ul>
                    {item.children.map((child, childIndex) => (
                      <li key={`${child}-${childIndex}`}>
                        {renderProfileInlineText(child, `child-${blockIndex}-${itemIndex}-${childIndex}`)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

function ProfileGeneralTab({ profile, reports }: { profile: UserPublic; reports: UserPublic[] }) {
  const { t } = useLanguage();

  return (
    <>
      <div className="infoGrid" style={{ marginTop: 0 }}>
        <div className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
          <div className="cardInner">
            <div className="muted" style={{ fontSize: 13 }}>Email</div>
            <a style={{ marginTop: 6, display: "block" }} href={`mailto:${profile.email}`}>{profile.email}</a>
          </div>
        </div>
        <div className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
          <div className="cardInner">
            <div className="muted" style={{ fontSize: 13 }}>{t("form.location")}</div>
            <div style={{ marginTop: 6 }}>{profile.location ?? "—"}</div>
          </div>
        </div>
        <div className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
          <div className="cardInner">
            <div className="muted" style={{ fontSize: 13 }}>{t("form.phone")}</div>
            {profile.phone ? (
              <a style={{ marginTop: 6, display: "block" }} href={`tel:${profile.phone}`}>{profile.phone}</a>
            ) : (
              <div style={{ marginTop: 6 }}>—</div>
            )}
          </div>
        </div>
        <div className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
          <div className="cardInner">
            <div className="muted" style={{ fontSize: 13 }}>График работы</div>
            <div style={{ marginTop: 6 }}>{formatWorkSchedule(profile)}</div>
          </div>
        </div>
      </div>

      <div className="profileWorkGrid">
        <div className="profileInfoCard">
          <div className="cardInner">
            <h3 style={{ margin: 0, fontSize: 16 }}>{t("form.manager")}</h3>
            {profile.manager ? (
              <Link className="profilePersonLink" to={`/users/${profile.manager.id}`}>
                {profile.manager.first_name} {profile.manager.last_name}
                <span>{profile.manager.title || t("users.noPosition")}</span>
              </Link>
            ) : (
              <div className="muted" style={{ marginTop: 10 }}>Не назначен</div>
            )}
          </div>
        </div>
        <div className="profileInfoCard">
          <div className="cardInner">
            <h3 style={{ margin: 0, fontSize: 16 }}>Подчиненные</h3>
            <div className="profileReports">
              {reports.slice(0, 6).map((employee) => (
                <Link key={employee.id} to={`/users/${employee.id}`}>
                  {employee.first_name} {employee.last_name}
                </Link>
              ))}
              {reports.length === 0 && <div className="muted">Нет подчиненных в системе.</div>}
              {reports.length > 6 && <div className="muted">Еще {reports.length - 6}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="profileAboutSection">
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          О сотруднике
        </div>
        <RichTextContent value={profile.bio} />
      </div>
    </>
  );
}

function EducationDevelopmentTab({ profile }: { profile: UserPublic }) {
  const educationItems = profile.education_records ?? [];
  const additionalEducationItems = profile.additional_education_records ?? [];
  const certificateItems = profile.certificate_records ?? [];
  const courseItems = profile.course_records ?? [];
  const skillItems = profile.skills ?? [];

  return (
    <div className="profileSectionGrid">
      <ProfileSection title="Высшее образование">
        {educationItems.length === 0 && <ProfileEmptyState>Данные о высшем образовании пока не заполнены.</ProfileEmptyState>}
        {educationItems.map((item, index) => (
          <ProfileDataCard key={[item.school, item.graduationYear, index].join("-")}>
            <strong>{item.school}</strong>
            <span>Факультет: {item.faculty}</span>
            <span>Специальность: {item.specialty}</span>
            <span>Год окончания: {item.graduationYear}</span>
          </ProfileDataCard>
        ))}
      </ProfileSection>

      <ProfileSection title="Дополнительное образование">
        {additionalEducationItems.length === 0 && <ProfileEmptyState>Дополнительное образование пока не добавлено.</ProfileEmptyState>}
        {additionalEducationItems.map((item, index) => (
          <ProfileDataCard key={[item.organization, item.course, index].join("-")}>
            <strong>{item.course}</strong>
            <span>Организация: {item.organization}</span>
            <span>Дата: {item.date}</span>
          </ProfileDataCard>
        ))}
      </ProfileSection>

      <ProfileSection title="Сертификаты">
        {certificateItems.length === 0 && <ProfileEmptyState>Сертификаты пока не добавлены.</ProfileEmptyState>}
        {certificateItems.map((item, index) => (
          <ProfileDataCard key={[item.title, item.issuedAt, index].join("-")}>
            <strong>{item.title}</strong>
            <span>Организация: {item.organization}</span>
            <span>Дата получения: {item.issuedAt}</span>
            <span>Срок действия: {item.validUntil || "не ограничен"}</span>
          </ProfileDataCard>
        ))}
      </ProfileSection>

      <ProfileSection title="Курсы">
        {courseItems.length === 0 && <ProfileEmptyState>Курсы пока не добавлены.</ProfileEmptyState>}
        {courseItems.map((item, index) => (
          <ProfileDataCard key={[item.title, item.provider, index].join("-")}>
            <strong>{item.title}</strong>
            <span>Провайдер: {item.provider}</span>
            <span>Продолжительность: {item.duration}</span>
            <span>Статус: {item.status}</span>
          </ProfileDataCard>
        ))}
      </ProfileSection>

      <ProfileSection title="Навыки">
        <div className="profileSkillList">
          {skillItems.length === 0 && <ProfileEmptyState>Навыки пока не добавлены.</ProfileEmptyState>}
          {skillItems.map((skill) => (
            <span className="profileSkillChip" key={skill}>{skill}</span>
          ))}
        </div>
      </ProfileSection>
    </div>
  );
}

function AchievementRecordsEditor({
  items,
  onChange,
}: {
  items: AchievementRecord[];
  onChange: (items: AchievementRecord[]) => void;
}) {
  const addAchievement = () => {
    onChange([...items, { icon: "🏆", title: "", description: "", date: "" }]);
  };

  const updateAchievement = (index: number, patch: Partial<AchievementRecord>) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeAchievement = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="achievementEditor">
      <div className="achievementEditorHeader">
        <div>
          <h3>Достижения</h3>
          <p>Каждое достижение заполняется и сохраняется отдельно.</p>
        </div>
        <button className="btn btnPrimary" type="button" onClick={addAchievement}>
          + Добавить достижение
        </button>
      </div>

      {items.length === 0 && (
        <div className="profileEmptyState">
          Достижений пока нет. Добавьте первую запись.
        </div>
      )}

      <div className="achievementEditorList">
        {items.map((item, index) => (
          <div className="achievementEditorItem" key={index}>
            <div className="achievementEditorItemHeader">
              <strong>Достижение {index + 1}</strong>
              <button
                className="achievementRemoveButton"
                type="button"
                title="Удалить достижение"
                aria-label={`Удалить достижение ${index + 1}`}
                onClick={() => removeAchievement(index)}
              >
                ×
              </button>
            </div>

            <div className="achievementEditorGrid">
              <label>
                <span>Иконка или смайлик</span>
                <input
                  className="input"
                  value={item.icon}
                  placeholder="🏆"
                  onChange={(event) => updateAchievement(index, { icon: event.target.value })}
                />
              </label>
              <label>
                <span>Дата или период</span>
                <input
                  className="input"
                  value={item.date}
                  placeholder="2026-07-23 или 2025-2026"
                  onChange={(event) => updateAchievement(index, { date: event.target.value })}
                />
              </label>
              <label className="achievementEditorWideField">
                <span>Заголовок</span>
                <input
                  className="input"
                  value={item.title}
                  placeholder="Название достижения"
                  onChange={(event) => updateAchievement(index, { title: event.target.value })}
                />
              </label>
              <label className="achievementEditorWideField">
                <span>Описание</span>
                <RichTextEditor
                  value={item.description}
                  placeholder="Что было сделано и какой результат получен"
                  maxLength={3000}
                  onChange={(description) => updateAchievement(index, { description })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <button className="btn achievementAddBottom" type="button" onClick={addAchievement}>
          + Добавить ещё
        </button>
      )}
    </div>
  );
}

function AchievementsTab({ achievements }: { achievements: AchievementRecord[] }) {
  const getAchievementYear = (value: string) => value.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;
  const years = Array.from(new Set(achievements.map((item) => getAchievementYear(item.date)).filter((item): item is string => Boolean(item))))
    .sort((a, b) => Number(b) - Number(a));
  const [year, setYear] = useState<string>("all");
  const filtered = year === "all"
    ? achievements
    : achievements.filter((item) => getAchievementYear(item.date) === year);

  return (
    <div className="profileSectionGrid">
      <div className="profileFilterRow">
        <span className="muted">Фильтр по году</span>
        <select className="input" value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="all">Все годы</option>
          {years.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="profileTimeline">
        {filtered.length === 0 && <ProfileEmptyState>Достижения пока не добавлены.</ProfileEmptyState>}
        {filtered.map((item, index) => {
          const iconIsCompact = Array.from(item.icon || "").length <= 4;
          const displayIcon = iconIsCompact ? (item.icon || "🏆") : "🏆";
          const displayTitle = item.title || (!iconIsCompact ? item.icon : "") || "Достижение";
          return (
          <div className="profileTimelineItem" key={[item.title, item.date, index].join("-")}>
            <div className="profileTimelineIcon">{displayIcon}</div>
            <div className="profileInfoCard">
              <div className="cardInner">
                <div className="muted" style={{ fontSize: 13 }}>{item.date ? formatRuDate(item.date) : "Дата не указана"}</div>
                <h3 style={{ margin: "6px 0 0", fontSize: 16 }}>{displayTitle}</h3>
                {item.description && (
                  <div className="achievementDescription">
                    <RichTextContent value={item.description} />
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function GratitudeTab({ profileId, currentUserId }: { profileId: number; currentUserId: number | null }) {
  const pageSize = 5;
  const canCreate = currentUserId !== null && currentUserId !== profileId;
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EmployeeGratitudeListPublic | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadGratitudes(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<EmployeeGratitudeListPublic>(
        `/users/${profileId}/gratitudes?page=${nextPage}&page_size=${pageSize}`,
      );
      setData(response);
      setPage(response.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить благодарности.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGratitudes(1);
  }, [profileId]);

  async function submitGratitude(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await apiFetch<EmployeeGratitudePublic>(`/users/${profileId}/gratitudes`, {
        method: "POST",
        body: JSON.stringify({ content: content.trim() }),
      });
      setContent("");
      await loadGratitudes(1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось оставить благодарность.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleLike(item: EmployeeGratitudePublic) {
    const previous = data;
    if (previous) {
      setData({
        ...previous,
        total_likes: previous.total_likes + (item.liked_by_me ? -1 : 1),
        items: previous.items.map((gratitude) =>
          gratitude.id === item.id
            ? {
                ...gratitude,
                liked_by_me: !gratitude.liked_by_me,
                likes_count: gratitude.likes_count + (gratitude.liked_by_me ? -1 : 1),
              }
            : gratitude,
        ),
      });
    }

    try {
      const updated = await apiFetch<EmployeeGratitudePublic>(`/users/gratitudes/${item.id}/like`, {
        method: "POST",
      });
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((gratitude) => (gratitude.id === updated.id ? updated : gratitude)),
            }
          : current,
      );
    } catch (likeError) {
      if (previous) setData(previous);
      setError(likeError instanceof Error ? likeError.message : "Не удалось поставить лайк.");
    }
  }

  const items = data?.items ?? [];
  const totalCount = data?.total_count ?? 0;
  const totalLikes = data?.total_likes ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="profileSectionGrid">
      <div className="profileStatsGrid">
        <div className="profileInfoCard">
          <div className="cardInner">
            <div className="muted" style={{ fontSize: 13 }}>Получено благодарностей</div>
            <strong style={{ marginTop: 6, display: "block", fontSize: 24 }}>{totalCount}</strong>
          </div>
        </div>
        <div className="profileInfoCard">
          <div className="cardInner">
            <div className="muted" style={{ fontSize: 13 }}>Получено лайков</div>
            <strong style={{ marginTop: 6, display: "block", fontSize: 24 }}>{totalLikes}</strong>
          </div>
        </div>
      </div>

      {canCreate && (
        <form className="profileGratitudeForm" onSubmit={submitGratitude}>
          <textarea
            className="input"
            rows={3}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Напишите благодарность сотруднику"
          />
          <button className="btn btnPrimary" type="submit" disabled={saving || !content.trim()}>
            {saving ? "Отправляем..." : "Оставить благодарность"}
          </button>
        </form>
      )}

      {error && <div style={{ color: "#b42318" }}>{error}</div>}

      <div className="profileGratitudeList">
        {loading && <ProfileEmptyState>Загружаем благодарности...</ProfileEmptyState>}
        {!loading && items.length === 0 && <ProfileEmptyState>Благодарности пока не добавлены.</ProfileEmptyState>}
        {!loading && items.map((item) => {
          const authorName = `${item.author.first_name} ${item.author.last_name}`;
          return (
            <div className="profileInfoCard" key={item.id}>
              <div className="cardInner profileGratitudeCard">
                <div className="avatar commentAvatar">
                  {item.author.avatar_url ? (
                    <img className="avatarImage" src={item.author.avatar_url} alt={authorName} />
                  ) : (
                    getInitialsFromName(authorName)
                  )}
                </div>
                <div>
                  <strong>{authorName}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>{item.author.title || "Сотрудник"}</div>
                  <div style={{ marginTop: 10 }}>{item.content}</div>
                  <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>{formatNewsDateTime(item.created_at)}</div>
                </div>
                <button
                  className={`gratitudeLikeButton ${item.liked_by_me ? "gratitudeLikeButtonActive" : ""}`}
                  type="button"
                  onClick={() => toggleLike(item)}
                  aria-label="Поставить лайк"
                >
                  Сердце {item.likes_count}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="profilePagination">
        <button className="btn" type="button" disabled={page === 1 || loading} onClick={() => loadGratitudes(Math.max(1, page - 1))}>
          Назад
        </button>
        <span className="muted">Страница {page} из {pageCount}</span>
        <button className="btn" type="button" disabled={page === pageCount || loading} onClick={() => loadGratitudes(Math.min(pageCount, page + 1))}>
          Далее
        </button>
      </div>
    </div>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="profileInfoCard">
      <div className="cardInner">
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <div className="profileSectionBody">{children}</div>
      </div>
    </section>
  );
}

function ProfileDataCard({ children }: { children: ReactNode }) {
  return <div className="profileDataCard">{children}</div>;
}

function ProfileEditTextarea({
  label,
  hint,
  rows,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{label}</div>
      <textarea
        className="input"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={hint}
      />
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{hint}</div>
    </label>
  );
}

function ProfileEmptyState({ children }: { children: ReactNode }) {
  return <div className="profileEmptyState">{children}</div>;
}

function getInitialsFromName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
