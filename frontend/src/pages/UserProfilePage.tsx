import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { UserPublic } from "../api/types";

export function UserProfilePage() {
  const { id } = useParams();
  const userId = useMemo(() => (id ? Number(id) : NaN), [id]);

  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);

    if (!Number.isFinite(userId)) {
      setLoading(false);
      setError("Некорректный id сотрудника.");
      return;
    }

    apiFetch<UserPublic>(`/users/${userId}`)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setError("Нужно войти, чтобы видеть карточку сотрудника.");
        } else if (e instanceof ApiError && e.status === 404) {
          setError("Сотрудник не найден.");
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
  }, [userId]);

  if (loading) {
    return (
      <section className="card">
        <div className="cardInner" style={{ padding: 18 }}>
          <div className="muted">Загрузка…</div>
        </div>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section className="card">
        <div className="cardInner">
          <h1 style={{ margin: 0 }}>{error ?? "Сотрудник не найден"}</h1>
          <div className="muted" style={{ marginTop: 8 }}>
            Попробуйте открыть карточку из списка сотрудников или войти в
            систему.
          </div>
          <div style={{ marginTop: 14 }}>
            <Link className="btn" to="/users">
              ← К списку
            </Link>
            <Link className="btn" to="/login" state={{ from: `/users/${id}` }}>
              Войти
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const initials = `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div className="grid2">
      <section className="card">
        <div className="cardInner">
          <div className="row">
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "rgba(124,58,237,0.28)",
                border: "1px solid rgba(124,58,237,0.55)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              {initials}
            </div>
            <div>
              <h1 style={{ margin: 0 }}>{fullName}</h1>
              <div className="muted" style={{ marginTop: 6 }}>
                {profile.title ?? "—"}
              </div>
            </div>
            <div className="spacer" />
            <Link className="btn" to="/users">
              ← К списку
            </Link>
          </div>

          <div style={{ marginTop: 14, lineHeight: 1.6 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              Описание
            </div>
            <div>{profile.bio ?? "—"}</div>
          </div>
        </div>
      </section>

      <aside className="card">
        <div className="cardInner">
          <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Контакты</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>
                Email
              </div>
              <div>{profile.email}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>
                Локация
              </div>
              <div>{profile.location ?? "—"}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>
                Телефон
              </div>
              <div>{profile.phone ?? "—"}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

