import { FormEvent, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { SystemUpdatePublic, UserPublic } from "../api/types";

type ShellContext = {
  me: UserPublic | null;
};

type UpdateForm = {
  title: string;
  body: string;
};

const emptyForm: UpdateForm = {
  title: "",
  body: "",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function authorName(item: SystemUpdatePublic) {
  return `${item.author.first_name} ${item.author.last_name}`;
}

export function SystemUpdatesPage() {
  const { me } = useOutletContext<ShellContext>();
  const [items, setItems] = useState<SystemUpdatePublic[]>([]);
  const [form, setForm] = useState<UpdateForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = me?.role === "admin";

  async function loadUpdates() {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiFetch<SystemUpdatePublic[]>("/system-updates"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить изменения.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUpdates();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const created = await apiFetch<SystemUpdatePublic>("/system-updates", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
        }),
      });
      setItems((current) => [created, ...current]);
      setForm(emptyForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить изменение.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUpdate(item: SystemUpdatePublic) {
    if (!window.confirm(`Удалить запись "${item.title}"?`)) return;

    await apiFetch<void>(`/system-updates/${item.id}`, { method: "DELETE" });
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  return (
    <section className="systemUpdatesPage">
      <div className="card pageHero">
        <div className="cardInner">
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <span className="newsBadge">Система</span>
              <h1 style={{ margin: "10px 0 8px" }}>Изменения в соцсети</h1>
              <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
                Короткий журнал обновлений: новые разделы, улучшения, исправления и важные изменения внутри портала.
              </p>
            </div>
            <div className="spacer" />
            <Link className="btn" to="/">
              Назад
            </Link>
          </div>
        </div>
      </div>

      {canManage && (
        <div className="card systemUpdateComposer">
          <div className="cardInner">
            <h2 style={{ margin: "0 0 12px" }}>Добавить изменение</h2>
            <form onSubmit={handleSubmit} className="systemUpdateForm">
              <input
                className="input"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Например: Новый дашборд выдачи курьерам"
              />
              <textarea
                className="input"
                rows={5}
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                placeholder="Опишите, что добавилось или изменилось. Можно писать коротко, по делу."
              />
              <div className="row">
                <button className="btn btnPrimary" type="submit" disabled={saving || !form.title.trim() || !form.body.trim()}>
                  {saving ? "Публикуем..." : "Опубликовать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="card">
          <div className="cardInner">{error}</div>
        </div>
      )}

      {loading && (
        <div className="card">
          <div className="cardInner muted">Загружаем изменения...</div>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="card">
          <div className="cardInner muted">Пока нет опубликованных изменений.</div>
        </div>
      )}

      <div className="systemUpdateList">
        {items.map((item) => (
          <article className="card systemUpdateItem" key={item.id}>
            <div className="cardInner">
              <div className="systemUpdateMeta">
                <span>{formatDateTime(item.created_at)}</span>
                <span>{authorName(item)}</span>
              </div>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              {canManage && (
                <button className="btn btnDanger" type="button" onClick={() => deleteUpdate(item)}>
                  Удалить
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
