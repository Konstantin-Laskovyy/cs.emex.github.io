import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { useLanguage } from "../i18n";
import type { NewsPublic, UpcomingBirthdayPublic, UserPublic } from "../api/types";

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

function formatBirthdayDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
  }).format(new Date(`${value}T00:00:00`));
}

function getInitials(user: { first_name: string; last_name: string }) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

export function HomePage() {
  useOutletContext<ShellContext>();
  const { t } = useLanguage();
  const [news, setNews] = useState<NewsPublic[]>([]);
  const [expandedNews, setExpandedNews] = useState<Set<number>>(() => new Set());
  const [birthdays, setBirthdays] = useState<UpcomingBirthdayPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      apiFetch<NewsPublic[]>("/news"),
      apiFetch<UpcomingBirthdayPublic[]>("/users/birthdays/upcoming"),
    ])
      .then(([newsData, birthdayData]) => {
        if (cancelled) return;
        setNews(newsData);
        setBirthdays(birthdayData);
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
    <section className="homeLayout">
      <div className="homeFeed">
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
                          getInitials(item.author)
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
                    <p>{item.summary}</p>
                  </div>

                  {item.content && (
                    <>
                      <div
                        className={`newsContent newsContentPreview ${expandedNews.has(item.id) ? "newsContentPreviewExpanded" : ""}`}
                        dangerouslySetInnerHTML={{ __html: item.content }}
                      />
                      <button
                        className="newsExpandButton"
                        type="button"
                        onClick={() =>
                          setExpandedNews((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                      >
                        {expandedNews.has(item.id) ? "Свернуть" : "Показать полностью"}
                      </button>
                    </>
                  )}

                  <div className="row newsCardActions">
                    <Link className="btn btnNewsRead" to={`/news/${item.id}`}>
                      {t("home.read")}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="homeSidebar">
        <div className="card birthdayDashboard">
          <div className="cardInner">
            <div className="newsBadge">Дни рождения</div>
            <h2>Ближайшие именинники</h2>
            <div className="birthdayList">
              {birthdays.length === 0 && <div className="muted">Нет данных по ИИН.</div>}
              {birthdays.map((item) => {
                const fullName = `${item.user.first_name} ${item.user.last_name}`;
                return (
                  <Link className="birthdayItem" to={`/users/${item.user.id}`} key={item.user.id}>
                    <div className="avatar avatarRound birthdayAvatar">
                      {item.user.avatar_url ? (
                        <img src={item.user.avatar_url} alt={fullName} className="avatarImage" />
                      ) : (
                        getInitials(item.user)
                      )}
                    </div>
                    <div>
                      <strong>{fullName}</strong>
                      <span>{formatBirthdayDate(item.next_date)}</span>
                      <small>{item.days_until === 0 ? "Сегодня" : `через ${item.days_until} дн.`}</small>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
