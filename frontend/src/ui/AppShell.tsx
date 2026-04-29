import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AUTH_EXPIRED_EVENT, ApiError, apiFetch, expireSession, getToken, setToken } from "../api/client";
import { availableLanguages, useLanguage } from "../i18n";
import type { Language } from "../i18n";
import type { NotificationPublic, UserPublic } from "../api/types";

type NavItem = {
  to: string;
  labelKey: string;
  icon: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: "⌂" },
  { to: "/users", labelKey: "nav.users", icon: "С" },
  { to: "/departments", labelKey: "nav.departments", icon: "О" },
  { to: "/org", labelKey: "nav.org", icon: "◇" },
  { to: "/admin", labelKey: "nav.admin", icon: "А", adminOnly: true },
];

function getInitials(user: UserPublic | null) {
  if (!user) return "...";
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, languageLabel, setLanguage, t } = useLanguage();
  const [me, setMe] = useState<UserPublic | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationPublic[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => localStorage.getItem("sidebar_pinned") === "true");

  const hasToken = useMemo(() => Boolean(getToken()), [location.key]);
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  useEffect(() => {
    function handleAuthExpired() {
      setMe(null);
      setNotifications([]);
      setNotificationsOpen(false);
      setUserPanelOpen(false);
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
          setMeError(error?.message || t("top.profile"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.key, location.pathname, location.search, navigate, t]);

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
    setUserPanelOpen(false);
    if (notifications.some((item) => !item.is_read)) {
      await apiFetch<void>("/notifications/read-all", { method: "POST" });
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    }
  }

  function handleLogout() {
    expireSession();
    setMe(null);
    setUserPanelOpen(false);
    navigate("/login", { replace: true });
  }

  function toggleSidebarPinned() {
    setIsSidebarPinned((current) => {
      const next = !current;
      localStorage.setItem("sidebar_pinned", String(next));
      return next;
    });
  }

  return (
    <div className="appLayout">
      <aside className={`appSidebar ${isSidebarPinned ? "appSidebarPinned" : ""}`} aria-label="Основная навигация">
        <div className="sidebarBrand">
          <Link to="/" className="sidebarBrandLink" aria-label="EMEX Social">
            <img src="/emex_logo.png" alt="EMEX" className="sidebarLogo" />
            <span className="sidebarText">EMEX Social</span>
          </Link>
          <button
            className="sidebarPinButton"
            type="button"
            aria-pressed={isSidebarPinned}
            title={isSidebarPinned ? t("sidebar.unpin") : t("sidebar.pin")}
            onClick={toggleSidebarPinned}
          >
            {isSidebarPinned ? "×" : "›"}
          </button>
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
                title={t(item.labelKey)}
              >
                <span className="sidebarIcon">{item.icon}</span>
                <span className="sidebarText">{t(item.labelKey)}</span>
              </NavLink>
            ))}
        </nav>
      </aside>

      {hasToken && (
        <header className="topHeader">
          <div className="topHeaderSpacer" />
          <div className="topHeaderActions">
            <label className="languageSelectWrap" title={t("top.language")}>
              <span className="languageIcon">◎</span>
              <select
                className="languageSelect"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                aria-label={t("top.language")}
              >
                {availableLanguages.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="languageLabel">{languageLabel}</span>
            </label>
            <div className="topUserPanel">
              <button className="topIconButton" type="button" onClick={markNotificationsRead} title={t("top.notifications")}>
                !
                {unreadCount > 0 && <span className="topPanelBadge">{unreadCount}</span>}
              </button>
              <button className="topUserButton" type="button" onClick={() => setUserPanelOpen((current) => !current)}>
                <span className="topUserText">
                  <strong>{me ? `${me.first_name} ${me.last_name}` : meError ?? t("top.profile")}</strong>
                  <small>{me?.title || t("top.employee")}</small>
                </span>
                <span className="topUserAvatar">
                  {me?.avatar_url ? (
                    <img src={me.avatar_url} alt={`${me.first_name} ${me.last_name}`} />
                  ) : (
                    getInitials(me)
                  )}
                </span>
                <span className="topUserArrow">⌄</span>
              </button>

              {notificationsOpen && (
                <div className="notificationsDropdown topNotificationsDropdown">
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
                  {notifications.length === 0 && <div className="notificationEmpty">{t("top.noNotifications")}</div>}
                </div>
              )}

              {userPanelOpen && (
                <div className="topUserDropdown">
                  <Link to="/news/new" onClick={() => setUserPanelOpen(false)}>
                    {t("top.addNews")}
                  </Link>
                  {me && (
                    <Link to={`/users/${me.id}`} onClick={() => setUserPanelOpen(false)}>
                      {t("top.myProfile")}
                    </Link>
                  )}
                  <Link to="/users" onClick={() => setUserPanelOpen(false)}>
                    {t("nav.users")}
                  </Link>
                  {me?.role === "admin" && (
                    <Link to="/admin" onClick={() => setUserPanelOpen(false)}>
                      {t("nav.admin")}
                    </Link>
                  )}
                  <button type="button" onClick={handleLogout}>
                    {t("top.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="appMainFrame">
        <main className="container appMain">
          <Outlet context={{ me }} />
        </main>

        <footer className="container appFooter">
          <div className="muted">{t("footer.text")}</div>
        </footer>
      </div>
    </div>
  );
}
