import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ApiError, apiFetch, getToken, setToken } from "../api/client";
import type { NotificationPublic, UserPublic } from "../api/types";

const navLinkStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid transparent",
  background: "transparent",
};

function getNavStyle(isActive: boolean): React.CSSProperties {
  return {
    ...navLinkStyle,
    borderColor: isActive ? "#0b5cad" : "transparent",
    background: isActive
      ? "#eef6ff"
      : "transparent",
    boxShadow: "none",
    color: isActive ? "#073f7f" : "#132238",
  };
}

export function AppShell() {
  const location = useLocation();
  const [me, setMe] = useState<UserPublic | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationPublic[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const hasToken = useMemo(() => Boolean(getToken()), [location.key]);

  useEffect(() => {
    let cancelled = false;
    setMeError(null);
    setMe(null);

    if (!getToken()) return;

    apiFetch<UserPublic>("/users/me")
      .then((data) => {
        if (cancelled) return;
        setMe(data);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setToken(null);
        } else {
          setMeError(error?.message || "Профиль недоступен");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.key]);

  useEffect(() => {
    let cancelled = false;
    if (!getToken()) return;

    apiFetch<NotificationPublic[]>("/notifications")
      .then((data) => {
        if (!cancelled) setNotifications(data);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });

    return () => {
      cancelled = true;
    };
  }, [location.key]);

  async function markNotificationsRead() {
    setNotificationsOpen((current) => !current);
    if (notifications.some((item) => !item.is_read)) {
      await apiFetch<void>("/notifications/read-all", { method: "POST" });
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div
          style={{
            borderBottom: "1px solid #d9e2ef",
            background: "#ffffff",
            boxShadow: "0 6px 18px rgba(17, 37, 63, 0.06)",
          }}
        >
          <div className="container" style={{ padding: "12px 0" }}>
            <div className="row">
              <Link to="/" style={{ color: "#0b5cad", fontSize: 22, fontWeight: 800 }}>
                EMEX Social
              </Link>
              <div className="spacer" />
              <nav className="row appNav">
                <NavLink to="/" style={({ isActive }) => getNavStyle(isActive)}>
                  Главная
                </NavLink>
                <NavLink to="/users" style={({ isActive }) => getNavStyle(isActive)}>
                  Сотрудники
                </NavLink>
                <NavLink to="/departments" style={({ isActive }) => getNavStyle(isActive)}>
                  Отделы
                </NavLink>
                <NavLink to="/org" style={({ isActive }) => getNavStyle(isActive)}>
                  Оргструктура
                </NavLink>
                {me?.role === "admin" && (
                  <NavLink to="/admin" style={({ isActive }) => getNavStyle(isActive)}>
                    Админка
                  </NavLink>
                )}
              </nav>
              <div className="spacer" />
              {hasToken && (
                <div className="row" style={{ gap: 10 }}>
                  <div className="notificationsMenu">
                    <button className="btn notificationButton" type="button" onClick={markNotificationsRead}>
                      Уведомления
                      {notifications.filter((item) => !item.is_read).length > 0 && (
                        <span className="notificationBadge">{notifications.filter((item) => !item.is_read).length}</span>
                      )}
                    </button>
                    {notificationsOpen && (
                      <div className="notificationsDropdown">
                        {notifications.map((item) => (
                          <Link
                            className={`notificationItem ${item.is_read ? "" : "notificationItemUnread"}`}
                            key={item.id}
                            to={item.link || "/"}
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <strong>{item.title}</strong>
                            <span>{item.body}</span>
                          </Link>
                        ))}
                        {notifications.length === 0 && <div className="notificationEmpty">Пока уведомлений нет.</div>}
                      </div>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {me ? `${me.first_name} ${me.last_name}` : meError ?? "..."}
                  </div>
                  {me && (
                    <Link className="btn" to={`/users/${me.id}`}>
                      Мой профиль
                    </Link>
                  )}
                  <button
                    className="btn"
                    onClick={() => {
                      setToken(null);
                      setMe(null);
                    }}
                    type="button"
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: "18px 0 40px" }}>
        <Outlet context={{ me }} />
      </main>

      <footer className="container" style={{ padding: "16px 0 26px" }}>
        <div className="muted" style={{ fontSize: 13 }}>
          Внутренняя социальная сеть компании Emex.
        </div>
      </footer>
    </div>
  );
}
