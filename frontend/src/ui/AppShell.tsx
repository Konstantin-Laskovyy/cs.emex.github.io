import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AUTH_EXPIRED_EVENT, ApiError, apiFetch, expireSession, getToken, setToken } from "../api/client";
import type { NotificationPublic, UserPublic } from "../api/types";

type NavItem = {
  to: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "Главная", icon: "⌂" },
  { to: "/users", label: "Сотрудники", icon: "👥" },
  { to: "/departments", label: "Отделы", icon: "▦" },
  { to: "/org", label: "Оргструктура", icon: "◇" },
  { to: "/admin", label: "Админка", icon: "⚙", adminOnly: true },
];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState<UserPublic | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationPublic[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const hasToken = useMemo(() => Boolean(getToken()), [location.key]);
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  useEffect(() => {
    function handleAuthExpired() {
      setMe(null);
      setNotifications([]);
      setNotificationsOpen(false);
      navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [location.pathname, location.search, navigate]);

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
          navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
        } else {
          setMeError(error?.message || "Профиль недоступен");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.key, location.pathname, location.search, navigate]);

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

  function handleLogout() {
    expireSession();
    setMe(null);
    navigate("/login", { replace: true });
  }

  return (
    <div className="appLayout">
      <aside className="appSidebar" aria-label="Основная навигация">
        <div className="sidebarBrand">
          <Link to="/" className="sidebarBrandLink" aria-label="EMEX Social">
            <img src="/emex_logo.png" alt="EMEX" className="sidebarLogo" />
            <span className="sidebarText">EMEX Social</span>
          </Link>
          <span className="sidebarChevron">›</span>
        </div>

        <nav className="sidebarNav">
          {navItems
            .filter((item) => !item.adminOnly || me?.role === "admin")
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `sidebarNavItem ${isActive ? "sidebarNavItemActive" : ""}`}
                title={item.label}
              >
                <span className="sidebarIcon">{item.icon}</span>
                <span className="sidebarText">{item.label}</span>
              </NavLink>
            ))}
        </nav>

        {hasToken && (
          <div className="sidebarBottom">
            <div className="sidebarDivider" />

            <div className="notificationsMenu sidebarNotifications">
              <button className="sidebarNavItem sidebarButton" type="button" onClick={markNotificationsRead} title="Уведомления">
                <span className="sidebarIcon">●</span>
                <span className="sidebarText">Уведомления</span>
                {unreadCount > 0 && <span className="notificationBadge sidebarBadge">{unreadCount}</span>}
              </button>
              {notificationsOpen && (
                <div className="notificationsDropdown sidebarNotificationsDropdown">
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

            <div className="sidebarUser">
              <div className="sidebarUserAvatar">
                {me?.avatar_url ? (
                  <img src={me.avatar_url} alt={`${me.first_name} ${me.last_name}`} />
                ) : (
                  <span>{me ? `${me.first_name[0] ?? ""}${me.last_name[0] ?? ""}`.toUpperCase() : "…"}</span>
                )}
              </div>
              <div className="sidebarUserInfo sidebarText">
                <strong>{me ? `${me.first_name} ${me.last_name}` : meError ?? "Профиль"}</strong>
                {me && <span>{me.title || "Сотрудник компании"}</span>}
              </div>
            </div>

            {me && (
              <Link className="sidebarNavItem" to={`/users/${me.id}`} title="Мой профиль">
                <span className="sidebarIcon">◉</span>
                <span className="sidebarText">Мой профиль</span>
              </Link>
            )}

            <button className="sidebarNavItem sidebarButton" type="button" onClick={handleLogout} title="Выйти">
              <span className="sidebarIcon">⎋</span>
              <span className="sidebarText">Выйти</span>
            </button>
          </div>
        )}
      </aside>

      <div className="appMainFrame">
        <main className="container appMain">
          <Outlet context={{ me }} />
        </main>

        <footer className="container appFooter">
          <div className="muted">Внутренняя социальная сеть компании Emex.</div>
        </footer>
      </div>
    </div>
  );
}
