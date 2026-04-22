import { FormEvent, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { apiFetch } from "../api/client";
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

export function NewsEditorPage() {
  const navigate = useNavigate();
  const { me } = useOutletContext<ShellContext>();
  const [form, setForm] = useState<NewsFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const item = await apiFetch<NewsPublic>("/news", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim(),
          content: form.content.trim(),
        }),
      });
      navigate(`/news/${item.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось опубликовать новость.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <div className="cardInner">
        <div className="row" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>Новая новость</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              Публикация будет создана от имени {me ? `${me.first_name} ${me.last_name}` : "сотрудника"}.
            </div>
          </div>
          <div className="spacer" />
          <Link className="btn" to="/">
            ← На главную
          </Link>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 18, display: "grid", gap: 14 }}>
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
              placeholder="Коротко опишите, о чем эта публикация"
            />
          </label>

          <label>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Полный текст новости</div>
            <textarea
              className="input"
              rows={10}
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              placeholder="Полный текст публикации"
            />
          </label>

          {error && <div style={{ color: "#fecaca" }}>{error}</div>}

          <div className="row">
            <button className="btn btnPrimary" type="submit" disabled={saving}>
              {saving ? "Публикуем..." : "Опубликовать новость"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
