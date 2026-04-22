import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
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

const emptyForm: NewsFormState = {
  title: "",
  summary: "",
  content: "",
};

function formatNewsDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function HomePage() {
  const { me } = useOutletContext<ShellContext>();
  const [news, setNews] = useState<NewsPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<NewsFormState>(emptyForm);

  const initials = useMemo(() => {
    if (!me) return "ЕС";
    return `${me.first_name?.[0] ?? ""}${me.last_name?.[0] ?? ""}`.toUpperCase() || "ЕС";
  }, [me]);

  async function loadNews() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<NewsPublic[]>("/news");
      setNews(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setLoadError("Нужно войти, чтобы видеть новости компании.");
      } else {
        setLoadError(error instanceof Error ? error.message : "Не удалось загрузить новости.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNews();
  }, []);

  function startEditing(item: NewsPublic) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      summary: item.summary,
      content: item.content,
    });
    setSaveError(null);
    setSaveMessage(null);
  }

  function resetEditor() {
    setEditingId(null);
    setForm(emptyForm);
    setSaveError(null);
    setSaveMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
    };

    try {
      const item = editingId
        ? await apiFetch<NewsPublic>(`/news/${editingId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiFetch<NewsPublic>("/news", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setNews((current) => {
        if (editingId) {
          return current.map((entry) => (entry.id === item.id ? item : entry));
        }
        return [item, ...current];
      });

      setSaveMessage(editingId ? "Новость обновлена." : "Новость опубликована.");
      setEditingId(null);
      setForm(emptyForm);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить новость.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="homeLayout">
      <aside className="homeSidebar">
        <section className="card">
          <div className="cardInner" style={{ display: "grid", gap: 14 }}>
            <div className="profileCard">
              <div className="avatar avatarRound avatarHero">
                {me?.avatar_url ? (
                  <img className="avatarImage" src={me.avatar_url} alt={`${me.first_name} ${me.last_name}`} />
                ) : (
                  initials
                )}
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {me ? `${me.first_name} ${me.last_name}` : "Сотрудник"}
                </div>
                <div className="muted" style={{ fontSize: 14 }}>
                  {me?.title || "Сотрудник компании"}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Link className="btn btnPrimary" to="/users">
                Открыть сотрудников
              </Link>
              <Link className="btn" to="/departments">
                Открыть отделы
              </Link>
              {me && (
                <Link className="btn" to={`/users/${me.id}`}>
                  Открыть мой профиль
                </Link>
              )}
            </div>
          </div>
        </section>
      </aside>

      <section className="homeFeed">
        <div className="newsHero card">
          <div className="cardInner">
            <div className="newsBadge">Главная</div>
            <h1 style={{ margin: "8px 0 10px", fontSize: 34, lineHeight: 1.05 }}>Новости компании</h1>
            <div className="muted" style={{ maxWidth: 720, lineHeight: 1.6 }}>
              Здесь сотрудники видят важные новости компании, а авторы могут публиковать и обновлять свои объявления.
            </div>
          </div>
        </div>

        <section className="card">
          <div className="cardInner">
            <div className="row" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>
                  {editingId ? "Редактирование новости" : "Новая новость"}
                </h2>
                <div className="muted" style={{ marginTop: 6 }}>
                  Публикация появится на главной странице для всех авторизованных сотрудников.
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Заголовок</div>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Короткий заголовок новости"
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Краткое описание</div>
                <textarea
                  className="input"
                  rows={3}
                  value={form.summary}
                  onChange={(event) => setForm({ ...form, summary: event.target.value })}
                  placeholder="Коротко опишите суть новости"
                />
              </label>

              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Текст новости</div>
                <textarea
                  className="input"
                  rows={6}
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder="Полный текст публикации"
                />
              </label>

              {saveMessage && <div style={{ color: "#bfdbfe" }}>{saveMessage}</div>}
              {saveError && <div style={{ color: "#fecaca" }}>{saveError}</div>}

              <div className="row" style={{ flexWrap: "wrap" }}>
                <button className="btn btnPrimary" type="submit" disabled={saving}>
                  {saving ? "Сохраняем..." : editingId ? "Сохранить изменения" : "Опубликовать"}
                </button>
                {editingId && (
                  <button className="btn" type="button" onClick={resetEditor}>
                    Отменить редактирование
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        {loadError && (
          <div
            className="card"
            style={{
              boxShadow: "none",
              background: "rgba(239,68,68,0.12)",
              borderColor: "rgba(239,68,68,0.55)",
            }}
          >
            <div className="cardInner">{loadError}</div>
          </div>
        )}

        {loading && <div className="muted">Загрузка новостей...</div>}

        {!loading && !loadError && news.length === 0 && (
          <div className="card">
            <div className="cardInner muted">Пока новостей нет. Опубликуйте первую запись на главной странице.</div>
          </div>
        )}

        <div className="newsList">
          {news.map((item) => {
            const fullName = `${item.author.first_name} ${item.author.last_name}`;
            const canEdit = me?.id === item.author_id;

            return (
              <article key={item.id} className="card newsCard">
                <div className="cardInner">
                  <div className="newsCardTop">
                    <span className="newsTag">Новость</span>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {formatNewsDate(item.created_at)}
                    </span>
                  </div>

                  <h2 style={{ margin: "10px 0 8px", fontSize: 22 }}>{item.title}</h2>

                  <div className="newsAuthor">
                    <div className="avatar avatarRound newsAuthorAvatar">
                      {item.author.avatar_url ? (
                        <img src={item.author.avatar_url} alt={fullName} className="avatarImage" />
                      ) : (
                        `${item.author.first_name[0] ?? ""}${item.author.last_name[0] ?? ""}`.toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{fullName}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {item.author.title || "Сотрудник компании"}
                      </div>
                    </div>
                    <div className="spacer" />
                    {canEdit && (
                      <button className="btn" type="button" onClick={() => startEditing(item)}>
                        Редактировать
                      </button>
                    )}
                  </div>

                  <p style={{ margin: "16px 0 10px", fontWeight: 600, lineHeight: 1.6 }}>{item.summary}</p>
                  <div className="muted newsContent">{item.content}</div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
