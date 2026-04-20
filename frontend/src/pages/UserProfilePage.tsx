import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { DepartmentPublic, UserPublic, UserUpdate } from "../api/types";

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
  };
}

export function UserProfilePage() {
  const { id } = useParams();
  const userId = useMemo(() => (id ? Number(id) : NaN), [id]);

  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [employees, setEmployees] = useState<UserPublic[]>([]);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setProfile(null);
    setForm(null);

    if (!Number.isFinite(userId)) {
      setLoading(false);
      setLoadError("Некорректный id сотрудника.");
      return;
    }

    Promise.all([
      apiFetch<UserPublic>(`/users/${userId}`),
      apiFetch<DepartmentPublic[]>("/departments"),
      apiFetch<UserPublic[]>("/users"),
    ])
      .then(([profileData, departmentsData, employeesData]) => {
        if (cancelled) return;
        setProfile(profileData);
        setDepartments(departmentsData);
        setEmployees(employeesData);
        setForm(toFormState(profileData));
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setLoadError("Нужно войти, чтобы видеть карточку сотрудника.");
        } else if (e instanceof ApiError && e.status === 404) {
          setLoadError("Сотрудник не найден.");
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
  }, [userId]);

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

    try {
      const updated = await apiFetch<UserPublic>(`/users/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setProfile(updated);
      setForm(toFormState(updated));
      setSaveMessage("Профиль сотрудника обновлен.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось сохранить изменения.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="card">
        <div className="cardInner" style={{ padding: 18 }}>
          <div className="muted">Загрузка...</div>
        </div>
      </section>
    );
  }

  if (loadError || !profile || !form) {
    return (
      <section className="card">
        <div className="cardInner">
          <h1 style={{ margin: 0 }}>{loadError ?? "Сотрудник не найден"}</h1>
          <div className="muted" style={{ marginTop: 8 }}>
            Попробуйте открыть карточку из списка сотрудников или войти в систему.
          </div>
          <div style={{ marginTop: 14 }} className="row">
            <Link className="btn" to="/users">
              ← К списку
            </Link>
            <Link className="btn" to="/login" state={{ from: `/users/${id}` }}>
              Войти
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const managerOptions = employees.filter((employee) => employee.id !== profile.id);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <div className="cardInner">
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
                {profile.title ?? "Должность не указана"}
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
            <Link className="btn" to="/users">
              ← К списку
            </Link>
          </div>

          <div className="infoGrid" style={{ marginTop: 18 }}>
            <div className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
              <div className="cardInner">
                <div className="muted" style={{ fontSize: 13 }}>Email</div>
                <div style={{ marginTop: 6 }}>{profile.email}</div>
              </div>
            </div>
            <div className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
              <div className="cardInner">
                <div className="muted" style={{ fontSize: 13 }}>Локация</div>
                <div style={{ marginTop: 6 }}>{profile.location ?? "—"}</div>
              </div>
            </div>
            <div className="card" style={{ boxShadow: "none", background: "rgba(255,255,255,0.03)" }}>
              <div className="cardInner">
                <div className="muted" style={{ fontSize: 13 }}>Телефон</div>
                <div style={{ marginTop: 6 }}>{profile.phone ?? "—"}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              О сотруднике
            </div>
            <div>{profile.bio ?? "Описание пока не заполнено."}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="cardInner">
          <div className="row" style={{ alignItems: "baseline" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Редактирование профиля</h2>
              <div className="muted" style={{ marginTop: 6 }}>
                Можно обновить фотографию, должность, отдел и руководителя.
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <div className="formGrid">
              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Имя</div>
                <input
                  className="input"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Фамилия</div>
                <input
                  className="input"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Должность</div>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Отдел</div>
                <select
                  className="input"
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                >
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
                <select
                  className="input"
                  value={form.manager_id}
                  onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                >
                  <option value="">Не назначен</option>
                  {managerOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Фото (URL)</div>
                <input
                  className="input"
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                  placeholder="https://..."
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Локация</div>
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Телефон</div>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
            </div>

            <label>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Описание</div>
              <textarea
                className="input"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={5}
              />
            </label>

            {saveMessage && <div style={{ color: "#bfdbfe" }}>{saveMessage}</div>}
            {saveError && <div style={{ color: "#fecaca" }}>{saveError}</div>}

            <div className="row">
              <button className="btn btnPrimary" type="submit" disabled={saving}>
                {saving ? "Сохраняем..." : "Сохранить изменения"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
