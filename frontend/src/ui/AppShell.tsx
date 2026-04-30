import { useEffect, useMemo, useRef, useState } from "react";
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
  { to: "/analytics", labelKey: "nav.analytics", icon: "A", adminOnly: true },
  { to: "/admin", labelKey: "nav.admin", icon: "А", adminOnly: true },
];

function getInitials(user: UserPublic | null) {
  if (!user) return "...";
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

function NavIcon({ labelKey }: { labelKey: string }) {
  if (labelKey === "nav.home") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 15.5 16 5l11 10.5" className="sidebarIconStroke" />
        <path d="M8.5 14.5v12h15v-12" className="sidebarIconStroke" />
        <path d="M13 26.5v-7h6v7" className="sidebarIconFill" />
        <path d="M21.5 7.5v4.7" className="sidebarIconStroke" />
      </svg>
    );
  }

  if (labelKey === "nav.users") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="12.5" cy="10" r="5.5" className="sidebarIconFill" />
        <path d="M4.5 26.5c.6-6.1 3.6-9.2 8-9.2s7.4 3.1 8 9.2H4.5Z" className="sidebarIconFill" />
        <circle cx="23" cy="12" r="4" className="sidebarIconFill sidebarIconSecondary" />
        <path d="M20.7 26.5c-.2-3.6-1.2-6.3-3-8.1a7 7 0 0 1 4.8-1.7c3.4 0 5.6 2.8 6 9.8h-7.8Z" className="sidebarIconFill sidebarIconSecondary" />
      </svg>
    );
  }

  if (labelKey === "nav.departments") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8 6.5h16a2 2 0 0 1 2 2v18H6v-18a2 2 0 0 1 2-2Z" className="sidebarIconFill" />
        <path d="M11 11h4v4h-4zM17 11h4v4h-4zM11 18h4v4h-4zM17 18h4v4h-4z" className="sidebarIconWindow" />
        <path d="M13.5 26.5v-6h5v6" className="sidebarIconWindow" />
      </svg>
    );
  }

  if (labelKey === "nav.org") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 4.5 22 10l-6 5.5L10 10l6-5.5Z" className="sidebarIconStroke" />
        <path d="M16 16v5M8 21v-3.5h16V21" className="sidebarIconStroke" />
        <rect x="4.5" y="21" width="7" height="6.5" rx="1.4" className="sidebarIconFill" />
        <rect x="12.5" y="21" width="7" height="6.5" rx="1.4" className="sidebarIconFill" />
        <rect x="20.5" y="21" width="7" height="6.5" rx="1.4" className="sidebarIconFill" />
      </svg>
    );
  }

  if (labelKey === "nav.analytics") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 25.5h20" className="sidebarIconStroke" />
        <rect x="8" y="16" width="4.5" height="8" rx="1.2" className="sidebarIconFill sidebarIconSecondary" />
        <rect x="14" y="10" width="4.5" height="14" rx="1.2" className="sidebarIconFill" />
        <rect x="20" y="6.5" width="4.5" height="17.5" rx="1.2" className="sidebarIconFill sidebarIconSecondary" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 4.5 25 8v7.3c0 5.7-3.7 10.4-9 12.2-5.3-1.8-9-6.5-9-12.2V8l9-3.5Z" className="sidebarIconFill" />
      <circle cx="16" cy="13" r="3.6" className="sidebarIconWindow" />
      <path d="M10.5 23c.5-4.1 2.5-6.1 5.5-6.1s5 2 5.5 6.1h-11Z" className="sidebarIconWindow" />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.8 12h16.4M12 3.5c2.2 2.2 3.3 5 3.3 8.5S14.2 18.3 12 20.5C9.8 18.3 8.7 15.5 8.7 12S9.8 5.7 12 3.5Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.8 10.7a5.2 5.2 0 0 1 10.4 0v3.8l1.7 2.6H5.1l1.7-2.6v-3.8Z" />
      <path d="M10 19.2c.5.8 1.1 1.3 2 1.3s1.5-.5 2-1.3" />
      <path d="M12 4.2v-1" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7.5 9.5 4.5 4.7 4.5-4.7" />
    </svg>
  );
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
  const topActionsRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!topActionsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
        setUserPanelOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setUserPanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
                <span className="sidebarIcon">
                  <NavIcon labelKey={item.labelKey} />
                </span>
                <span className="sidebarText">{t(item.labelKey)}</span>
              </NavLink>
            ))}
        </nav>
      </aside>

      {hasToken && (
        <header className="topHeader">
          <div className="topHeaderSpacer" />
          <div className="topHeaderActions" ref={topActionsRef}>
            <label className="languageSelectWrap" title={t("top.language")}>
              <span className="languageIcon">
                <LanguageIcon />
              </span>
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
                <BellIcon />
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
                <span className="topUserArrow">
                  <ChevronDownIcon />
                </span>
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
