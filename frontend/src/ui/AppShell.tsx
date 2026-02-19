import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ApiError, apiFetch, getToken, setToken } from "../api/client";
import type { UserPublic } from "../api/types";

const navLinkStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
};

export function AppShell() {
  const location = useLocation();
  const [me, setMe] = useState<UserPublic | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  const hasToken = useMemo(() => Boolean(getToken()), [location.key]);

  useEffect(() => {
    let cancelled = false;
    setMeError(null);
    setMe(null);
    if (!getToken()) return;

    apiFetch<UserPublic>("/me")
      .then((data) => {
        if (cancelled) return;
        setMe(data);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setToken(null);
        } else {
          setMeError(e?.message || "Ошибка /me");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [location.key]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(11,18,32,0.55)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="container" style={{ padding: "12px 0" }}>
            <div className="row">
              <Link to="/" style={{ fontWeight: 700, letterSpacing: 0.2 }}>
                Intranet Social
              </Link>
              <div className="spacer" />
              <nav className="row" style={{ gap: 10 }}>
                <NavLink
                  to="/"
                  style={({ isActive }) => ({
                    ...navLinkStyle,
                    borderColor: isActive
                      ? "rgba(124,58,237,0.7)"
                      : "rgba(255,255,255,0.12)",
                    background: isActive
                      ? "rgba(124,58,237,0.22)"
                      : "rgba(255,255,255,0.06)",
                  })}
                >
                  Главная
                </NavLink>
                <NavLink
                  to="/users"
                  style={({ isActive }) => ({
                    ...navLinkStyle,
                    borderColor: isActive
                      ? "rgba(124,58,237,0.7)"
                      : "rgba(255,255,255,0.12)",
                    background: isActive
                      ? "rgba(124,58,237,0.22)"
                      : "rgba(255,255,255,0.06)",
                  })}
                >
                  Сотрудники
                </NavLink>
                <NavLink
                  to="/departments"
                  style={({ isActive }) => ({
                    ...navLinkStyle,
                    borderColor: isActive
                      ? "rgba(124,58,237,0.7)"
                      : "rgba(255,255,255,0.12)",
                    background: isActive
                      ? "rgba(124,58,237,0.22)"
                      : "rgba(255,255,255,0.06)",
                  })}
                >
                  Отделы
                </NavLink>
              </nav>
              <div className="spacer" />
              {hasToken ? (
                <div className="row" style={{ gap: 10 }}>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {me ? `${me.first_name} ${me.last_name}` : meError ? "Профиль недоступен" : "…"}
                  </div>
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
              ) : (
                <Link
                  className="btn"
                  to="/login"
                  state={{ from: location.pathname }}
                >
                  Войти
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: "18px 0 40px" }}>
        <Outlet />
      </main>

      <footer className="container" style={{ padding: "16px 0 26px" }}>
        <div className="muted" style={{ fontSize: 13 }}>
          MVP — внутренняя социальная сеть компании.
        </div>
      </footer>
    </div>
  );
}

