import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { DepartmentPublic, UserCreate, UserPublic } from "../api/types";

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
  bio: "",
};

function getInitials(user: UserPublic) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("query") ?? "";
  const departmentId = params.get("department_id") ?? "";

  const [users, setUsers] = useState<UserPublic[]>([]);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [form, setForm] = useState<CreateFormState>(emptyCreateForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const queryTrimmed = useMemo(() => query.trim(), [query]);

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
    let cancelled = false;

    loadData()
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setLoadError("Нужно войти, чтобы видеть базу сотрудников.");
        } else {
          setLoadError(e?.message || "Ошибка загрузки.");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departmentId, queryTrimmed]);

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
      setSaveMessage("Новый сотрудник добавлен в базу.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось создать сотрудника.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <div className="cardInner">
        <div className="row" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>Сотрудники</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              База сотрудников с отделами, должностями, руководителями и фотографиями.
            </div>
          </div>
          <div className="spacer" />
          <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              className="input"
              placeholder="Поиск по имени, email или должности"
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
              <option value="">Все отделы</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="card" style={{ marginTop: 16, boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
          <div className="cardInner">
            <h2 style={{ margin: 0, fontSize: 20 }}>Добавить сотрудника</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Новый сотрудник сразу получит карточку, должность, отдел и руководителя. Фото можно указать ссылкой.
            </div>

            <form onSubmit={handleCreateEmployee} style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <div className="formGrid">
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Имя</div>
                  <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Фамилия</div>
                  <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Email</div>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Временный пароль</div>
                  <input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Должность</div>
                  <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Отдел</div>
                  <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                    <option value="">Не выбран</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Руководитель</div>
                  <select className="input" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                    <option value="">Не назначен</option>
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
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Локация</div>
                  <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </label>
                <label>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Телефон</div>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
              </div>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Описание</div>
                <textarea className="input" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>

              {saveMessage && <div style={{ color: "#bfdbfe" }}>{saveMessage}</div>}
              {saveError && <div style={{ color: "#fecaca" }}>{saveError}</div>}

              <div className="row">
                <button className="btn btnPrimary" type="submit" disabled={saving}>
                  {saving ? "Добавляем..." : "Добавить сотрудника"}
                </button>
              </div>
            </form>
          </div>
        </section>

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
                    Перейти к входу
                  </Link>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="muted">Загрузка...</div>}

          {!loading &&
            !loadError &&
            users.map((user) => {
              const fullName = `${user.first_name} ${user.last_name}`;
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
                          {user.title ?? "Должность не указана"}
                        </div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                          {user.department?.name ?? "Без отдела"} · {user.email}
                        </div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                          Руководитель:{" "}
                          {user.manager
                            ? `${user.manager.first_name} ${user.manager.last_name}`
                            : "не назначен"}
                        </div>
                      </div>

                      <div className="spacer" />
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        Открыть →
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

          {!loading && !loadError && users.length === 0 && (
            <div className="muted" style={{ padding: 8 }}>
              Ничего не найдено.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
