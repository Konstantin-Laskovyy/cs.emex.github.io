import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { DepartmentPayload, DepartmentPublic, NewsPublic, OrgRootPayload, OrgRootPublic, UserPublic } from "../api/types";

type ShellContext = {
  me: UserPublic | null;
};

const emptyDepartment: DepartmentPayload = {
  name: "",
  parent_id: null,
  manager_id: null,
};

export function AdminPage() {
  const { me } = useOutletContext<ShellContext>();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [news, setNews] = useState<NewsPublic[]>([]);
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [departmentDraft, setDepartmentDraft] = useState<DepartmentPayload>(emptyDepartment);
  const [departmentEdits, setDepartmentEdits] = useState<Record<number, DepartmentPayload>>({});
  const [orgRootDraft, setOrgRootDraft] = useState<OrgRootPayload>({ name: "ТОО «EMEX»", manager_id: null });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAdminData() {
    setLoading(true);
    setError(null);
    try {
      const [usersData, newsData, departmentsData, orgRootData] = await Promise.all([
        apiFetch<UserPublic[]>("/admin/users"),
        apiFetch<NewsPublic[]>("/admin/news"),
        apiFetch<DepartmentPublic[]>("/departments"),
        apiFetch<OrgRootPublic>("/departments/org-root"),
      ]);
      setUsers(usersData);
      setNews(newsData);
      setDepartments(departmentsData);
      setDepartmentEdits(
        Object.fromEntries(
          departmentsData.map((department) => [
            department.id,
            {
              name: department.name,
              parent_id: department.parent_id ?? null,
              manager_id: department.manager_id ?? null,
            },
          ])
        )
      );
      setOrgRootDraft({
        name: orgRootData.name,
        manager_id: orgRootData.manager_id ?? null,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить админку.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function updateUser(user: UserPublic, patch: Partial<Pick<UserPublic, "role" | "is_active">>) {
    setMessage(null);
    setError(null);
    try {
      const updated = await apiFetch<UserPublic>(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: patch.role ?? user.role,
          is_active: patch.is_active ?? user.is_active,
        }),
      });
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("Права сотрудника обновлены.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось обновить сотрудника.");
    }
  }

  async function deactivateUser(user: UserPublic) {
    if (!window.confirm(`Отключить учетную запись ${user.first_name} ${user.last_name}?`)) return;
    setMessage(null);
    setError(null);
    try {
      await apiFetch<void>(`/admin/users/${user.id}`, { method: "DELETE" });
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, is_active: false } : item))
      );
      setMessage("Учетная запись отключена.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось отключить учетную запись.");
    }
  }

  async function createDepartment() {
    setMessage(null);
    setError(null);
    try {
      const created = await apiFetch<DepartmentPublic>("/departments", {
        method: "POST",
        body: JSON.stringify(departmentDraft),
      });
      setDepartments((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setDepartmentEdits((current) => ({
        ...current,
        [created.id]: {
          name: created.name,
          parent_id: created.parent_id ?? null,
          manager_id: created.manager_id ?? null,
        },
      }));
      setDepartmentDraft(emptyDepartment);
      setMessage("Отдел создан.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось создать отдел.");
    }
  }

  async function updateOrgRoot() {
    setMessage(null);
    setError(null);
    try {
      const updated = await apiFetch<OrgRootPublic>("/departments/org-root", {
        method: "PATCH",
        body: JSON.stringify(orgRootDraft),
      });
      setOrgRootDraft({ name: updated.name, manager_id: updated.manager_id ?? null });
      setMessage("Верхний узел оргструктуры обновлен.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось обновить верхний узел.");
    }
  }

  async function updateDepartment(department: DepartmentPublic) {
    const draft = departmentEdits[department.id];
    if (!draft) return;
    setMessage(null);
    setError(null);
    try {
      const updated = await apiFetch<DepartmentPublic>(`/departments/${department.id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setDepartments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setDepartmentEdits((current) => ({
        ...current,
        [updated.id]: {
          name: updated.name,
          parent_id: updated.parent_id ?? null,
          manager_id: updated.manager_id ?? null,
        },
      }));
      setMessage("Отдел обновлен.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось обновить отдел.");
    }
  }

  async function deleteDepartment(department: DepartmentPublic) {
    if (!window.confirm(`Удалить отдел "${department.name}"?`)) return;
    setMessage(null);
    setError(null);
    try {
      await apiFetch<void>(`/departments/${department.id}`, { method: "DELETE" });
      setDepartments((current) => current.filter((item) => item.id !== department.id));
      setDepartmentEdits((current) => {
        const next = { ...current };
        delete next[department.id];
        return next;
      });
      setMessage("Отдел удален.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить отдел.");
    }
  }

  async function deleteNews(item: NewsPublic) {
    if (!window.confirm(`Удалить новость "${item.title}"?`)) return;
    setMessage(null);
    setError(null);
    try {
      await apiFetch<void>(`/news/${item.id}`, { method: "DELETE" });
      setNews((current) => current.filter((entry) => entry.id !== item.id));
      setMessage("Новость удалена.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить новость.");
    }
  }

  if (me?.role !== "admin") {
    return (
      <section className="card">
        <div className="cardInner">
          <h1 style={{ margin: 0 }}>Недостаточно прав</h1>
          <div className="muted" style={{ marginTop: 8 }}>
            Этот раздел доступен только администраторам.
          </div>
        </div>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <div className="cardInner">
          <h1 style={{ margin: 0 }}>Администрирование</h1>
          <div className="muted" style={{ marginTop: 8 }}>
            Управление ролями, доступом, отделами, оргструктурой и публикациями компании.
          </div>
          {loading && <div className="muted" style={{ marginTop: 14 }}>Загрузка...</div>}
          {message && <div style={{ marginTop: 14, color: "#0b5cad" }}>{message}</div>}
          {error && <div style={{ marginTop: 14, color: "#b42318" }}>{error}</div>}
        </div>
      </section>

      <section className="card">
        <div className="cardInner">
          <h2 style={{ margin: 0, fontSize: 22 }}>Отделы и оргструктура</h2>
          <div className="muted" style={{ marginTop: 8 }}>
            Создавайте отделы, меняйте названия, выбирайте родительский отдел и руководителя.
          </div>

          <div className="adminOrgRoot">
            <div>
              <div style={{ fontWeight: 800 }}>Верхний узел оргструктуры</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Это карточка над всеми отделами, например название компании и генеральный директор.
              </div>
            </div>
            <input
              className="input"
              value={orgRootDraft.name}
              onChange={(event) => setOrgRootDraft((current) => ({ ...current, name: event.target.value }))}
            />
            <select
              className="input"
              value={orgRootDraft.manager_id ?? ""}
              onChange={(event) =>
                setOrgRootDraft((current) => ({
                  ...current,
                  manager_id: event.target.value ? Number(event.target.value) : null,
                }))
              }
            >
              <option value="">Руководитель не назначен</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </option>
              ))}
            </select>
            <button className="btn btnPrimary" type="button" onClick={updateOrgRoot}>
              Сохранить верхний узел
            </button>
          </div>

          <div className="adminDepartmentCreate">
            <input
              className="input"
              placeholder="Название отдела"
              value={departmentDraft.name}
              onChange={(event) => setDepartmentDraft((current) => ({ ...current, name: event.target.value }))}
            />
            <select
              className="input"
              value={departmentDraft.parent_id ?? ""}
              onChange={(event) =>
                setDepartmentDraft((current) => ({
                  ...current,
                  parent_id: event.target.value ? Number(event.target.value) : null,
                }))
              }
            >
              <option value="">Без родительского отдела</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={departmentDraft.manager_id ?? ""}
              onChange={(event) =>
                setDepartmentDraft((current) => ({
                  ...current,
                  manager_id: event.target.value ? Number(event.target.value) : null,
                }))
              }
            >
              <option value="">Руководитель не назначен</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </option>
              ))}
            </select>
            <button className="btn btnPrimary" type="button" onClick={createDepartment}>
              Создать отдел
            </button>
          </div>

          <div className="adminList">
            {departments.map((department) => {
              const draft = departmentEdits[department.id] ?? {
                name: department.name,
                parent_id: department.parent_id ?? null,
                manager_id: department.manager_id ?? null,
              };
              const parentName = departments.find((item) => item.id === department.parent_id)?.name;
              return (
                <div className="adminDepartmentRow" key={department.id}>
                  <div>
                    <input
                      className="input"
                      value={draft.name}
                      onChange={(event) =>
                        setDepartmentEdits((current) => ({
                          ...current,
                          [department.id]: { ...draft, name: event.target.value },
                        }))
                      }
                    />
                    <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                      Сотрудников: {department.employee_count}
                      {parentName ? ` · Родитель: ${parentName}` : " · Верхний уровень"}
                    </div>
                  </div>
                  <select
                    className="input"
                    value={draft.parent_id ?? ""}
                    onChange={(event) =>
                      setDepartmentEdits((current) => ({
                        ...current,
                        [department.id]: {
                          ...draft,
                          parent_id: event.target.value ? Number(event.target.value) : null,
                        },
                      }))
                    }
                  >
                    <option value="">Без родительского отдела</option>
                    {departments
                      .filter((item) => item.id !== department.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                  <select
                    className="input"
                    value={draft.manager_id ?? ""}
                    onChange={(event) =>
                      setDepartmentEdits((current) => ({
                        ...current,
                        [department.id]: {
                          ...draft,
                          manager_id: event.target.value ? Number(event.target.value) : null,
                        },
                      }))
                    }
                  >
                    <option value="">Руководитель не назначен</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </option>
                    ))}
                  </select>
                  <div className="adminActions">
                    <button className="btn btnPrimary" type="button" onClick={() => updateDepartment(department)}>
                      Сохранить
                    </button>
                    <button
                      className="btn btnDanger"
                      type="button"
                      onClick={() => deleteDepartment(department)}
                      disabled={department.employee_count > 0}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })}
            {!loading && departments.length === 0 && <div className="muted">Отделов пока нет.</div>}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="cardInner">
          <h2 style={{ margin: 0, fontSize: 22 }}>Сотрудники и доступы</h2>
          <div className="adminList">
            {users.map((user) => (
              <div className="adminRow" key={user.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{user.first_name} {user.last_name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{user.email}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {user.is_active ? "Активен" : "Отключен"}
                  </div>
                </div>
                <div className="adminActions">
                  <select
                    className="input"
                    value={user.role}
                    onChange={(event) =>
                      updateUser(user, { role: event.target.value as UserPublic["role"] })
                    }
                    disabled={user.id === me.id}
                  >
                    <option value="employee">Сотрудник</option>
                    <option value="admin">Администратор</option>
                  </select>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => updateUser(user, { is_active: !user.is_active })}
                    disabled={user.id === me.id}
                  >
                    {user.is_active ? "Отключить" : "Включить"}
                  </button>
                  <Link className="btn" to={`/users/${user.id}`}>
                    Редактировать
                  </Link>
                  <button
                    className="btn btnDanger"
                    type="button"
                    onClick={() => deactivateUser(user)}
                    disabled={user.id === me.id || !user.is_active}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="cardInner">
          <h2 style={{ margin: 0, fontSize: 22 }}>Новости</h2>
          <div className="adminList">
            {news.map((item) => (
              <div className="adminRow" key={item.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Автор: {item.author.first_name} {item.author.last_name}
                  </div>
                </div>
                <div className="adminActions">
                  <Link className="btn" to={`/news/${item.id}`}>
                    Открыть
                  </Link>
                  <button className="btn btnDanger" type="button" onClick={() => deleteNews(item)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
            {!loading && news.length === 0 && <div className="muted">Новостей пока нет.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
