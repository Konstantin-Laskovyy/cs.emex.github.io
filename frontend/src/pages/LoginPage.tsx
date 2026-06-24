import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, getApiBaseUrl, setToken } from "../api/client";
import { useLanguage } from "../i18n";

type LocationState = { from?: string };

const DEFAULT_EMAIL_DOMAIN = "emex.kz";

function normalizeLogin(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@") || trimmed.includes("\\")) return trimmed;
  return `${trimmed}@${DEFAULT_EMAIL_DOMAIN}`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const state = (location.state ?? {}) as LocationState;
  const from = useMemo(() => state.from ?? "/", [state.from]);
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <section className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="cardInner">
        <h1 style={{ margin: "0 0 6px" }}>{t("login.title")}</h1>
        <div className="muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
          {t("login.subtitle")}
          <br />
          {t("login.api")} <code>{apiBaseUrl}</code>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);

            const normalizedEmail = normalizeLogin(email);

            if (!normalizedEmail || !password) {
              setError(t("login.empty"));
              return;
            }

            setLoading(true);
            apiFetch<{ access_token: string; token_type: string }>("/auth/login", {
              method: "POST",
              body: JSON.stringify({ email: normalizedEmail, password }),
              auth: false,
            })
              .then((response) => {
                setToken(response.access_token);
                navigate(from, { replace: true });
              })
              .catch((fetchError) => {
                setToken(null);
                setError(fetchError?.message || t("login.error"));
              })
              .finally(() => setLoading(false));
          }}
          style={{ display: "grid", gap: 10 }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {t("login.username")}
            </span>
            <input
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="konstantin.laskovyy"
            />
            <span className="muted" style={{ fontSize: 12 }}>
              Можно без домена: система добавит @{DEFAULT_EMAIL_DOMAIN}
            </span>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {t("form.password")}
            </span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder={t("login.passwordPlaceholder")}
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

          <button className="btn btnPrimary" type="submit" disabled={loading}>
            {loading ? t("login.loading") : t("login.submit")}
          </button>
        </form>
      </div>
    </section>
  );
}
