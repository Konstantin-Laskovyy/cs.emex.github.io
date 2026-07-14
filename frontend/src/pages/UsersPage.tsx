import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { useLanguage } from "../i18n";
import type { DepartmentPublic, UserCreate, UserPublic, WorkStatus } from "../api/types";

type CreateFormState = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  title: string;
  department_id: string;
  manager_id: string;
  avatar_url: string;
  location: string;
  phone: string;
  work_status: WorkStatus;
  workday_start: string;
  workday_end: string;
  bio: string;
};

const emptyCreateForm: CreateFormState = {
  email: "",
  password: "Password123!",
  first_name: "",
  last_name: "",
  title: "",
  department_id: "",
  manager_id: "",
  avatar_url: "",
  location: "",
  phone: "",
  work_status: "working",
  workday_start: "09:00",
  workday_end: "18:00",
  bio: "",
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

function parseZupLastVacation(value?: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  return {
    date: match[1],
    days: Number(match[2].replace(",", ".")),
  };
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

function getInitials(user: UserPublic) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

type OutletContext = {
  me: UserPublic | null;
};

export function UsersPage() {
  const { me } = useOutletContext<OutletContext>();
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const query = params.get("query") ?? "";
  const departmentId = params.get("department_id") ?? "";

  const [users, setUsers] = useState<UserPublic[]>([]);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [form, setForm] = useState<CreateFormState>(emptyCreateForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const queryTrimmed = useMemo(() => query.trim(), [query]);
  const canCreateEmployees = me?.role === "admin";

  async function loadData() {
    setLoading(true);
    setLoadError(null);

    const qs = new URLSearchParams();
    if (queryTrimmed) qs.set("query", queryTrimmed);
    if (departmentId) qs.set("department_id", departmentId);

    const [usersData, departmentsData] = await Promise.all([
      apiFetch<UserPublic[]>(`/users${qs.toString() ? `?${qs.toString()}` : ""}`),
      apiFetch<DepartmentPublic[]>("/departments"),
    ]);

    setUsers(usersData);
    setDepartments(departmentsData);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadData()
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setLoadError(t("users.loginRequired"));
        } else {
          setLoadError(e?.message || t("departments.loadError"));
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departmentId, queryTrimmed, t]);

  async function handleCreateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    const payload: UserCreate = {
      email: form.email.trim(),
      password: form.password.trim() || "Password123!",
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      title: form.title.trim() || null,
      department_id: form.department_id ? Number(form.department_id) : null,
      manager_id: form.manager_id ? Number(form.manager_id) : null,
      avatar_url: form.avatar_url.trim() || null,
      location: form.location.trim() || null,
      phone: form.phone.trim() || null,
      work_status: form.work_status,
      workday_start: form.workday_start,
      workday_end: form.workday_end,
      bio: form.bio.trim() || null,
    };

    try {
      const created = await apiFetch<UserPublic>("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUsers((current) =>
        [created, ...current].sort((a, b) =>
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "ru")
        )
      );
      setForm(emptyCreateForm);
      setShowCreateForm(false);
      setSaveMessage(t("users.addSubmit"));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось создать сотрудника.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card pageHero">
      <div className="cardInner">
        <div className="row" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>{t("users.title")}</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              {t("users.subtitle")}
            </div>
          </div>
          <div className="spacer" />
          <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              className="input"
              placeholder={t("users.search")}
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (value) next.set("query", value);
                  else next.delete("query");
                  return next;
                });
              }}
              style={{ width: 320 }}
            />
            <select
              className="input"
              value={departmentId}
              onChange={(e) => {
                const value = e.target.value;
                setParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (value) next.set("department_id", value);
                  else next.delete("department_id");
                  return next;
                });
              }}
              style={{ width: 220 }}
            >
              <option value="">{t("users.allDepartments")}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {canCreateEmployees && (
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => {
                  setShowCreateForm((current) => !current);
                  setSaveError(null);
                  setSaveMessage(null);
                }}
              >
                {showCreateForm ? "Скрыть форму" : t("users.addTitle")}
              </button>
            )}
          </div>
        </div>

        {canCreateEmployees && showCreateForm && (
        <section className="card" style={{ marginTop: 16, boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
          <div className="cardInner">
            <h2 style={{ margin: 0, fontSize: 20 }}>{t("users.addTitle")}</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {t("users.addSubtitle")}
            </div>

            <form onSubmit={handleCreateEmployee} style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <div className="formGrid">
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.firstName")}</div>
                  <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.lastName")}</div>
                  <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.email")}</div>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.tempPassword")}</div>
                  <input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.position")}</div>
                  <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.department")}</div>
                  <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                    <option value="">{t("form.notSelected")}</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.manager")}</div>
                  <select className="input" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                    <option value="">{t("form.notAssigned")}</option>
                    {users.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Фото (URL)</div>
                  <input className="input" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://..." />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.location")}</div>
                  <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.phone")}</div>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Статус</div>
                  <select className="input" value={form.work_status} onChange={(e) => setForm({ ...form, work_status: e.target.value as WorkStatus })}>
                    {workStatusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Начало рабочего дня</div>
                  <input className="input" type="time" value={form.workday_start} onChange={(e) => setForm({ ...form, workday_start: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Конец рабочего дня</div>
                  <input className="input" type="time" value={form.workday_end} onChange={(e) => setForm({ ...form, workday_end: e.target.value })} />
                </label>
              </div>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.description")}</div>
                <textarea className="input" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>

              {saveMessage && <div style={{ color: "#bfdbfe" }}>{saveMessage}</div>}
              {saveError && <div style={{ color: "#fecaca" }}>{saveError}</div>}

              <div className="row">
                <button className="btn btnPrimary" type="submit" disabled={saving}>
                  {saving ? t("users.adding") : t("users.addSubmit")}
                </button>
                <button
                  className="btn"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setShowCreateForm(false);
                    setForm(emptyCreateForm);
                    setSaveError(null);
                    setSaveMessage(null);
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </section>
        )}

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {loadError && !users.length && (
            <div
              className="card"
              style={{
                boxShadow: "none",
                background: "rgba(239,68,68,0.12)",
                borderColor: "rgba(239,68,68,0.55)",
              }}
            >
              <div className="cardInner">
                <div>{loadError}</div>
                <div style={{ marginTop: 10 }}>
                  <Link className="btn" to="/login" state={{ from: "/users" }}>
                    {t("common.signIn")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="muted">{t("common.loading")}</div>}

          {!loading &&
            !loadError &&
            users.map((user) => {
              const fullName = `${user.first_name} ${user.last_name}`;
              const effectiveWorkStatus = getEffectiveWorkStatus(user, now);
              return (
                <Link
                  key={user.id}
                  to={`/users/${user.id}`}
                  className="card"
                  style={{
                    boxShadow: "none",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="cardInner">
                    <div className="row" style={{ alignItems: "flex-start" }}>
                      <div className="avatar">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={fullName} className="avatarImage" />
                        ) : (
                          <span>{getInitials(user)}</span>
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{fullName}</div>
                        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                          {user.title ?? t("users.noPosition")}
                        </div>
                        <div
                          className={`employeeStatusBadge ${workStatusClassName[effectiveWorkStatus]}`}
                          style={{ marginTop: 8 }}
                        >
                          {getWorkStatusLabel(effectiveWorkStatus)}
                        </div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                          {user.department?.name ?? t("users.noDepartment")} · {user.email}
                        </div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                          График работы: {formatWorkSchedule(user)}
                        </div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                          {t("users.manager")}{" "}
                          {user.manager
                            ? `${user.manager.first_name} ${user.manager.last_name}`
                            : t("form.notAssigned")}
                        </div>
                      </div>

                      <div className="spacer" />
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {t("users.open")}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

          {!loading && !loadError && users.length === 0 && (
            <div className="muted" style={{ padding: 8 }}>
              {t("users.notFound")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
