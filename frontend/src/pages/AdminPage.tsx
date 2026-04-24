import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { NewsPublic, UserPublic } from "../api/types";

type ShellContext = {
  me: UserPublic | null;
};

export function AdminPage() {
  const { me } = useOutletContext<ShellContext>();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [news, setNews] = useState<NewsPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAdminData() {
    setLoading(true);
    setError(null);
    try {
      const [usersData, newsData] = await Promise.all([
        apiFetch<UserPublic[]>("/admin/users"),
        apiFetch<NewsPublic[]>("/admin/news"),
      ]);
      setUsers(usersData);
      setNews(newsData);
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
            Управление ролями, доступом сотрудников и публикациями компании.
          </div>
          {loading && <div className="muted" style={{ marginTop: 14 }}>Загрузка...</div>}
          {message && <div style={{ marginTop: 14, color: "#bfdbfe" }}>{message}</div>}
          {error && <div style={{ marginTop: 14, color: "#fecaca" }}>{error}</div>}
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
