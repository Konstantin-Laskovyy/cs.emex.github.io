import { useEffect, useMemo, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { useLanguage } from "../i18n";
import type { DepartmentPublic, UserPublic, UserUpdate, UserZupSettingsPublic } from "../api/types";

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
  hire_date: string;
  vacation_days_total: string;
  vacation_days_used: string;
  vacation_periods_text: string;
};

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
    hire_date: profile.hire_date ?? "",
    vacation_days_total: String(profile.vacation_days_total ?? 24),
    vacation_days_used: String(profile.vacation_days_used ?? 0),
    vacation_periods_text: (profile.vacation_periods ?? [])
      .map((period) => `${period.start_date} — ${period.end_date}${period.note ? ` | ${period.note}` : ""}`)
      .join("\n"),
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

function formatRuDate(value?: string | null) {
  if (!value) return "Не указано";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setProfile(null);
    setZupIin("");
    setForm(null);
    setIsEditing(false);

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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <div className={`cardInner ${canViewDashboard ? "profileCardInner" : ""}`}>
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="avatar avatarLarge">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={fullName} className="avatarImage" />
              ) : (
                <span>{getInitials(profile)}</span>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0 }}>{fullName}</h1>
              <div className="muted" style={{ marginTop: 6 }}>
                {profile.title ?? t("users.noPosition")}
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
            {canEditProfile && !isEditing && (
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => {
                  setForm(toFormState(profile));
                  setSaveError(null);
                  setSaveMessage(null);
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

          <div className="infoGrid" style={{ marginTop: 18 }}>
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
            <div>{profile.bio ?? "Описание пока не заполнено."}</div>
          </div>
        </div>
      </section>

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
              </div>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.description")}</div>
                <textarea className="input" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={5} />
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
    </div>
  );
}
