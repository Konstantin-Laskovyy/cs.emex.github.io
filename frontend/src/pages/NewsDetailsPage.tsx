import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { NewsPublic, UserPublic } from "../api/types";

type ShellContext = {
  me: UserPublic | null;
};

type NewsFormState = {
  title: string;
  summary: string;
  content: string;
};

function toFormState(item: NewsPublic): NewsFormState {
  return {
    title: item.title,
    summary: item.summary,
    content: item.content,
  };
}

function formatNewsDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NewsDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = useOutletContext<ShellContext>();
  const newsId = useMemo(() => (id ? Number(id) : NaN), [id]);

  const [news, setNews] = useState<NewsPublic | null>(null);
  const [form, setForm] = useState<NewsFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    if (!Number.isFinite(newsId)) {
      setLoading(false);
      setLoadError("Некорректный идентификатор новости.");
      return;
    }

    apiFetch<NewsPublic>(`/news/${newsId}`)
      .then((data) => {
        if (cancelled) return;
        setNews(data);
        setForm(toFormState(data));
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setLoadError("Новость не найдена.");
        } else {
          setLoadError(error instanceof Error ? error.message : "Не удалось загрузить новость.");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [newsId]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!news || !form) return;

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const updated = await apiFetch<NewsPublic>(`/news/${news.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim(),
          content: form.content.trim(),
        }),
      });
      setNews(updated);
      setForm(toFormState(updated));
      setEditing(false);
      setSaveMessage("Новость обновлена.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить изменения.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!news || !window.confirm(`Удалить новость "${news.title}"?`)) return;

    setDeleting(true);
    setSaveError(null);

    try {
      await apiFetch<void>(`/news/${news.id}`, { method: "DELETE" });
      navigate("/");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось удалить новость.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <section className="card">
        <div className="cardInner muted">Загрузка новости...</div>
      </section>
    );
  }

  if (loadError || !news || !form) {
    return (
      <section className="card">
        <div className="cardInner">
          <h1 style={{ margin: 0 }}>{loadError ?? "Новость не найдена"}</h1>
          <div style={{ marginTop: 14 }}>
            <Link className="btn" to="/">
              ← На главную
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const fullName = `${news.author.first_name} ${news.author.last_name}`;
  const canEdit = me?.id === news.author_id || me?.role === "admin";
  const canDelete = me?.role === "admin";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <div className="cardInner">
          <div className="row" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0 }}>{news.title}</h1>
              <div className="muted" style={{ marginTop: 8 }}>
                Опубликовано {formatNewsDate(news.created_at)}
              </div>
            </div>
            <div className="spacer" />
            <Link className="btn" to="/">
              ← На главную
            </Link>
            {canEdit && !editing && (
              <button className="btn btnPrimary" type="button" onClick={() => setEditing(true)}>
                Редактировать
              </button>
            )}
            {canDelete && (
              <button className="btn btnDanger" type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Удаляем..." : "Удалить"}
              </button>
            )}
          </div>

          <div className="newsAuthor" style={{ marginTop: 18 }}>
            <div className="avatar avatarRound newsAuthorAvatar">
              {news.author.avatar_url ? (
                <img src={news.author.avatar_url} alt={fullName} className="avatarImage" />
              ) : (
                `${news.author.first_name[0] ?? ""}${news.author.last_name[0] ?? ""}`.toUpperCase()
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{fullName}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {news.author.title || "Сотрудник компании"}
              </div>
            </div>
          </div>

          <p style={{ margin: "20px 0 12px", fontWeight: 600, lineHeight: 1.7 }}>{news.summary}</p>
          <div className="newsContent">{news.content}</div>
        </div>
      </section>

      {canEdit && editing && (
        <section className="card">
          <div className="cardInner">
            <h2 style={{ margin: 0, fontSize: 22 }}>Редактирование новости</h2>

            <form onSubmit={handleSave} style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Заголовок</div>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Краткое описание</div>
                <textarea
                  className="input"
                  rows={3}
                  value={form.summary}
                  onChange={(event) => setForm({ ...form, summary: event.target.value })}
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Полный текст новости</div>
                <textarea
                  className="input"
                  rows={10}
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                />
              </label>

              {saveMessage && <div style={{ color: "#bfdbfe" }}>{saveMessage}</div>}
              {saveError && <div style={{ color: "#fecaca" }}>{saveError}</div>}

              <div className="row">
                <button className="btn" type="button" onClick={() => setEditing(false)}>
                  Отменить
                </button>
                <button className="btn btnPrimary" type="submit" disabled={saving}>
                  {saving ? "Сохраняем..." : "Сохранить изменения"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
