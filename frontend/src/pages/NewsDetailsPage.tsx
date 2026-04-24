import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { NewsComment, NewsPublic, NewsReactionSummary, UserPublic } from "../api/types";

type ShellContext = {
  me: UserPublic | null;
};

type NewsFormState = {
  title: string;
  summary: string;
  content: string;
};

const reactionLabels: Record<NewsReactionSummary["reaction"], string> = {
  like: "Нравится",
  important: "Важно",
  read: "Прочитал",
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

function authorInitials(author: { first_name: string; last_name: string }) {
  return `${author.first_name[0] ?? ""}${author.last_name[0] ?? ""}`.toUpperCase();
}

export function NewsDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = useOutletContext<ShellContext>();
  const newsId = useMemo(() => (id ? Number(id) : NaN), [id]);

  const [news, setNews] = useState<NewsPublic | null>(null);
  const [form, setForm] = useState<NewsFormState | null>(null);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [reactions, setReactions] = useState<NewsReactionSummary[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function loadNews(cancelledRef?: { cancelled: boolean }) {
    if (!Number.isFinite(newsId)) {
      setLoading(false);
      setLoadError("Некорректный идентификатор новости.");
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [newsData, commentsData, reactionsData] = await Promise.all([
        apiFetch<NewsPublic>(`/news/${newsId}`),
        apiFetch<NewsComment[]>(`/news/${newsId}/comments`),
        apiFetch<NewsReactionSummary[]>(`/news/${newsId}/reactions`),
      ]);
      if (cancelledRef?.cancelled) return;
      setNews(newsData);
      setForm(toFormState(newsData));
      setComments(commentsData);
      setReactions(reactionsData);
    } catch (error) {
      if (cancelledRef?.cancelled) return;
      if (error instanceof ApiError && error.status === 404) {
        setLoadError("Новость не найдена.");
      } else {
        setLoadError(error instanceof Error ? error.message : "Не удалось загрузить новость.");
      }
    } finally {
      if (!cancelledRef?.cancelled) setLoading(false);
    }
  }

  useEffect(() => {
    const state = { cancelled: false };
    loadNews(state);
    return () => {
      state.cancelled = true;
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

  async function toggleReaction(reaction: NewsReactionSummary["reaction"]) {
    if (!news) return;
    const updated = await apiFetch<NewsReactionSummary[]>(`/news/${news.id}/reactions`, {
      method: "POST",
      body: JSON.stringify({ reaction }),
    });
    setReactions(updated);
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!news || !commentText.trim()) return;
    const created = await apiFetch<NewsComment>(`/news/${news.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: commentText.trim() }),
    });
    setComments((current) => [...current, created]);
    setCommentText("");
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
              На главную
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
              На главную
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
                authorInitials(news.author)
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

          <div className="reactionBar">
            {reactions.map((item) => (
              <button
                className={`reactionButton ${item.reacted_by_me ? "reactionButtonActive" : ""}`}
                key={item.reaction}
                type="button"
                onClick={() => toggleReaction(item.reaction)}
              >
                {reactionLabels[item.reaction]} <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      {canEdit && editing && (
        <section className="card">
          <div className="cardInner">
            <h2 style={{ margin: 0, fontSize: 22 }}>Редактирование новости</h2>

            <form onSubmit={handleSave} style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Заголовок</div>
                <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </label>
              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Краткое описание</div>
                <textarea className="input" rows={3} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
              </label>
              <label>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Полный текст новости</div>
                <textarea className="input" rows={10} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
              </label>

              {saveMessage && <div style={{ color: "#0b5cad" }}>{saveMessage}</div>}
              {saveError && <div style={{ color: "#b42318" }}>{saveError}</div>}

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

      <section className="card">
        <div className="cardInner">
          <h2 style={{ margin: 0, fontSize: 22 }}>Комментарии</h2>
          <form className="commentForm" onSubmit={submitComment}>
            <textarea
              className="input"
              rows={3}
              placeholder="Напишите комментарий..."
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
            />
            <button className="btn btnPrimary" type="submit">
              Отправить
            </button>
          </form>
          <div className="commentList">
            {comments.map((comment) => (
              <div className="commentItem" key={comment.id}>
                <div className="avatar commentAvatar">
                  {comment.author.avatar_url ? (
                    <img className="avatarImage" src={comment.author.avatar_url} alt={`${comment.author.first_name} ${comment.author.last_name}`} />
                  ) : (
                    authorInitials(comment.author)
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {comment.author.first_name} {comment.author.last_name}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{formatNewsDate(comment.created_at)}</div>
                  <div style={{ marginTop: 6, whiteSpace: "pre-line" }}>{comment.content}</div>
                </div>
              </div>
            ))}
            {comments.length === 0 && <div className="muted">Комментариев пока нет.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
