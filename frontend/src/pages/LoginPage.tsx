import { apiFetch, setToken } from "../api/client";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type LocationState = { from?: string };

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const from = useMemo(() => state.from ?? "/", [state.from]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <section className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="cardInner">
        <h1 style={{ margin: "0 0 6px" }}>Вход</h1>
        <div className="muted" style={{ marginBottom: 14 }}>
          На этом шаге форма без реальной авторизации. Подключим к API и JWT в
          блоке backend.
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!email || !password) {
              setError("Введите email и пароль.");
              return;
            }

            setLoading(true);
            apiFetch<{ access_token: string; token_type: string }>("/auth/login", {
              method: "POST",
              body: JSON.stringify({ email, password }),
              auth: false,
            })
              .then((r) => {
                setToken(r.access_token);
                navigate(from, { replace: true });
              })
              .catch((e) => {
                setToken(null);
                setError(e?.message || "Ошибка входа.");
              })
              .finally(() => setLoading(false));
          }}
          style={{ display: "grid", gap: 10 }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Email
            </span>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="name@company.local"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Пароль
            </span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <div
              className="card"
              style={{
                boxShadow: "none",
                borderColor: "rgba(239,68,68,0.55)",
                background: "rgba(239,68,68,0.12)",
              }}
            >
              <div className="cardInner">{error}</div>
            </div>
          )}

          <button className="btn btnPrimary" type="submit">
            {loading ? "Входим…" : "Войти"}
          </button>
        </form>
      </div>
    </section>
  );
}

