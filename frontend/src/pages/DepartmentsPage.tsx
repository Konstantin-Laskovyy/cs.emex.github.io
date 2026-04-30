import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { useLanguage } from "../i18n";
import type { DepartmentPublic } from "../api/types";

export function DepartmentsPage() {
  const { t } = useLanguage();
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
      .catch((fetchError) => {
        if (cancelled) return;
        if (fetchError instanceof ApiError && fetchError.status === 401) {
          setError(t("departments.loginRequired"));
        } else {
          setError(fetchError?.message || t("departments.loadError"));
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <section className="card pageHero">
      <div className="cardInner">
        <h1 style={{ margin: "0 0 6px" }}>{t("departments.title")}</h1>
        <div className="muted" style={{ marginBottom: 14 }}>
          {t("departments.subtitle")}
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
                  <Link className="btn" to="/login" state={{ from: "/departments" }}>
                    {t("common.signIn")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="muted">{t("common.loading")}</div>}

          {!loading &&
            !error &&
            departments.map((department) => (
              <Link
                key={department.id}
                to={`/users?department_id=${department.id}`}
                className="card"
                style={{
                  boxShadow: "none",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div className="cardInner">
                  <div className="row">
                    <div>
                      <div style={{ fontWeight: 650 }}>{department.name}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {department.employee_count} {t("departments.employee")}
                      </div>
                    </div>
                    <div className="spacer" />
                    <div className="muted" style={{ fontSize: 13 }}>
                      {department.parent_id ? t("departments.subdepartment") : t("departments.department")} →
                    </div>
                  </div>
                </div>
              </Link>
            ))}

          {!loading && !error && departments.length === 0 && (
            <div className="muted" style={{ padding: 8 }}>
              {t("common.noData")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
