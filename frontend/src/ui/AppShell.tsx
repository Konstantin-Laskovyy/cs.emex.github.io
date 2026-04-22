import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ApiError, apiFetch, getToken, setToken } from "../api/client";
import type { UserPublic } from "../api/types";

const navLinkStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(96,165,250,0.18)",
  background: "rgba(255,255,255,0.05)",
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

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div
          style={{
            borderBottom: "1px solid rgba(96,165,250,0.16)",
            background: "linear-gradient(180deg, rgba(10,19,36,0.9), rgba(9,17,31,0.78))",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="container" style={{ padding: "12px 0" }}>
            <div className="row">
              <Link to="/" style={{ fontWeight: 700, letterSpacing: 0.2 }}>
                Социальная сеть Emex
              </Link>
              <div className="spacer" />
              <nav className="row" style={{ gap: 10 }}>
                <NavLink
                  to="/"
                  style={({ isActive }) => ({
                    ...navLinkStyle,
                    borderColor: isActive ? "rgba(147,197,253,0.9)" : "rgba(96,165,250,0.18)",
                    background: isActive
                      ? "linear-gradient(180deg, rgba(59,130,246,0.34), rgba(29,78,216,0.26))"
                      : "rgba(255,255,255,0.05)",
                    boxShadow: isActive
                      ? "0 0 0 1px rgba(96,165,250,0.16), 0 10px 24px rgba(37,99,235,0.18)"
                      : "none",
                  })}
                >
                  Главная
                </NavLink>
                <NavLink
                  to="/users"
                  style={({ isActive }) => ({
                    ...navLinkStyle,
                    borderColor: isActive ? "rgba(147,197,253,0.9)" : "rgba(96,165,250,0.18)",
                    background: isActive
                      ? "linear-gradient(180deg, rgba(59,130,246,0.34), rgba(29,78,216,0.26))"
                      : "rgba(255,255,255,0.05)",
                    boxShadow: isActive
                      ? "0 0 0 1px rgba(96,165,250,0.16), 0 10px 24px rgba(37,99,235,0.18)"
                      : "none",
                  })}
                >
                  Сотрудники
                </NavLink>
                <NavLink
                  to="/departments"
                  style={({ isActive }) => ({
                    ...navLinkStyle,
                    borderColor: isActive ? "rgba(147,197,253,0.9)" : "rgba(96,165,250,0.18)",
                    background: isActive
                      ? "linear-gradient(180deg, rgba(59,130,246,0.34), rgba(29,78,216,0.26))"
                      : "rgba(255,255,255,0.05)",
                    boxShadow: isActive
                      ? "0 0 0 1px rgba(96,165,250,0.16), 0 10px 24px rgba(37,99,235,0.18)"
                      : "none",
                  })}
                >
                  Отделы
                </NavLink>
              </nav>
              <div className="spacer" />
              {hasToken && (
                <div className="row" style={{ gap: 10 }}>
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
