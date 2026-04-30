import { FormEvent, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useLanguage } from "../i18n";
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
  const { t } = useLanguage();
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
      setError(saveError instanceof Error ? saveError.message : t("home.loadError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card pageHero">
      <div className="cardInner">
        <div className="row" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>{t("newsEditor.title")}</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              {t("newsEditor.subtitlePrefix")} {me ? `${me.first_name} ${me.last_name}` : t("newsEditor.employee")}.
            </div>
          </div>
          <div className="spacer" />
          <Link className="btn" to="/">
            ← {t("common.backHome")}
          </Link>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <label>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.title")}</div>
            <input
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder={t("newsEditor.titlePlaceholder")}
            />
          </label>

          <label>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.summary")}</div>
            <textarea
              className="input"
              rows={3}
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              placeholder={t("newsEditor.summaryPlaceholder")}
            />
          </label>

          <label>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t("form.content")}</div>
            <textarea
              className="input"
              rows={10}
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              placeholder={t("newsEditor.contentPlaceholder")}
            />
          </label>

          {error && <div style={{ color: "#fecaca" }}>{error}</div>}

          <div className="row">
            <button className="btn btnPrimary" type="submit" disabled={saving}>
              {saving ? t("newsEditor.publishing") : t("newsEditor.publish")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
