import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { useLanguage } from "../i18n";
import type { NewsPublic, UserPublic } from "../api/types";

type ShellContext = {
  me: UserPublic | null;
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
  useOutletContext<ShellContext>();
  const { t } = useLanguage();
  const [news, setNews] = useState<NewsPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    apiFetch<NewsPublic[]>("/news")
      .then((data) => {
        if (cancelled) return;
        setNews(data);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setLoadError(t("home.loginRequired"));
        } else {
          setLoadError(error instanceof Error ? error.message : t("home.loadError"));
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
    <section className="homeFeed">
      <div className="newsHero card">
        <div className="cardInner">
          <div className="homeHeroTop">
            <img src="/emex_logo.png" alt="EMEX" className="homeHeroLogo" />
            <div className="newsBadge">{t("home.badge")}</div>
          </div>
          <h1 style={{ margin: "8px 0 10px", fontSize: 34, lineHeight: 1.05 }}>{t("home.title")}</h1>
          <div className="muted" style={{ maxWidth: 720, lineHeight: 1.6 }}>
            {t("home.subtitle")}
          </div>
        </div>
      </div>

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

      {loading && <div className="muted">{t("home.loading")}</div>}

      {!loading && !loadError && news.length === 0 && (
        <div className="card">
          <div className="cardInner muted">{t("home.empty")}</div>
        </div>
      )}

      <div className="newsList">
        {news.map((item) => {
          const fullName = `${item.author.first_name} ${item.author.last_name}`;

          return (
            <article key={item.id} className="card newsCard">
              <div className="cardInner">
                <div className="newsCardTop">
                  <div>
                    <span className="newsTag">{t("home.newsTag")}</span>
                    <h2 className="newsCardTitle">{item.title}</h2>
                  </div>
                  <div className="newsAuthor">
                    <div className="avatar avatarRound newsAuthorAvatar">
                      {item.author.avatar_url ? (
                        <img src={item.author.avatar_url} alt={fullName} className="avatarImage" />
                      ) : (
                        `${item.author.first_name[0] ?? ""}${item.author.last_name[0] ?? ""}`.toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{fullName}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatNewsDate(item.created_at)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="newsSummary">
                  <span className="newsSummaryLabel">Кратко</span>
                  <p>{item.summary}</p>
                </div>

                <div className="row" style={{ marginTop: 16 }}>
                  <Link className="btn btnPrimary" to={`/news/${item.id}`}>
                    {t("home.read")}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
