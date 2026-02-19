import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { DepartmentPublic } from "../api/types";

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<DepartmentPublic[]>("/departments")
      .then((data) => {
        if (cancelled) return;
        setDepartments(data);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setError("Нужно войти, чтобы видеть отделы.");
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
  }, []);

  return (
    <section className="card">
      <div className="cardInner">
        <h1 style={{ margin: "0 0 6px" }}>Отделы</h1>
        <div className="muted" style={{ marginBottom: 14 }}>
          Данные загружаются из API (нужна авторизация).
        </div>

        <div style={{ display: "grid", gap: 10 }}>
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
                  <Link
                    className="btn"
                    to="/login"
                    state={{ from: "/departments" }}
                  >
                    Перейти к входу
                  </Link>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="muted">Загрузка…</div>}

          {!loading &&
            !error &&
            departments.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{
                boxShadow: "none",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div className="cardInner">
                <div className="row">
                  <div style={{ fontWeight: 650 }}>{d.name}</div>
                  <div className="spacer" />
                  <div className="muted" style={{ fontSize: 13 }}>
                    {d.parent_id ? "подотдел" : "отдел"}
                  </div>
                </div>
              </div>
            </div>
            ))}

          {!loading && !error && departments.length === 0 && (
            <div className="muted" style={{ padding: 8 }}>
              Нет данных.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

