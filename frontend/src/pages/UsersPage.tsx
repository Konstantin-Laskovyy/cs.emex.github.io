import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { UserPublic } from "../api/types";

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("query") ?? "";

  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryTrimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (queryTrimmed) qs.set("query", queryTrimmed);

    apiFetch<UserPublic[]>(`/users${qs.toString() ? `?${qs.toString()}` : ""}`)
      .then((data) => {
        if (cancelled) return;
        setUsers(data);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setError("Нужно войти, чтобы видеть список сотрудников.");
        } else {
          setError(e?.message || "Ошибка загрузки.");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryTrimmed]);

  return (
    <section className="card">
      <div className="cardInner">
        <div className="row" style={{ alignItems: "baseline" }}>
          <div>
            <h1 style={{ margin: 0 }}>Сотрудники</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              Поиск работает через API (нужна авторизация).
            </div>
          </div>
          <div className="spacer" />
          <input
            className="input"
            placeholder="Поиск по имени…"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                if (v) next.set("query", v);
                else next.delete("query");
                return next;
              });
            }}
            style={{ maxWidth: 360 }}
          />
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {error && (
            <div
              className="card"
              style={{
                boxShadow: "none",
                background: "rgba(239,68,68,0.12)",
                borderColor: "rgba(239,68,68,0.55)",
              }}
            >
              <div className="cardInner">
                <div>{error}</div>
                <div style={{ marginTop: 10 }}>
                  <Link className="btn" to="/login" state={{ from: "/users" }}>
                    Перейти к входу
                  </Link>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="muted">Загрузка…</div>}

          {!loading &&
            !error &&
            users.map((u) => {
              const fullName = `${u.first_name} ${u.last_name}`;
              const initials = `${u.first_name[0] ?? ""}${u.last_name[0] ?? ""}`.toUpperCase();
              return (
                <Link
                  key={u.id}
                  to={`/users/${u.id}`}
                  className="card"
                  style={{
                    boxShadow: "none",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="cardInner">
                    <div className="row">
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: "rgba(124,58,237,0.28)",
                          border: "1px solid rgba(124,58,237,0.55)",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 700,
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 650 }}>{fullName}</div>
                        <div className="muted" style={{ fontSize: 14 }}>
                          {u.title ?? "—"} · {u.email}
                        </div>
                      </div>
                      <div className="spacer" />
                      <div className="muted" style={{ fontSize: 13 }}>
                        Открыть →
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

          {!loading && !error && users.length === 0 && (
            <div className="muted" style={{ padding: 8 }}>
              Ничего не найдено.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

