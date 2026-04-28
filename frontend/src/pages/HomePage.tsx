import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
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
  const { me } = useOutletContext<ShellContext>();
  const [news, setNews] = useState<NewsPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initials = useMemo(() => {
    if (!me) return "ЕС";
    return `${me.first_name?.[0] ?? ""}${me.last_name?.[0] ?? ""}`.toUpperCase() || "ЕС";
  }, [me]);

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
          setLoadError("Нужно войти, чтобы видеть новости компании.");
        } else {
          setLoadError(error instanceof Error ? error.message : "Не удалось загрузить новости.");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="homeLayout">
      <aside className="homeSidebar">
        <section className="card userMenuCard">
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
            <div className="menuTrigger" aria-hidden="true">
              <span>Меню</span>
              <span className="menuTriggerIcon">⌄⌄</span>
            </div>
            <div className="sidebarMenu">
                <Link className="btn btnPrimary" to="/news/new">
                  Добавить новость
                </Link>
                <Link className="btn" to="/users">
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
                {me?.role === "admin" && (
                  <Link className="btn" to="/admin">
                    Админка
                  </Link>
                )}
            </div>
          </div>
        </section>
      </aside>

      <section className="homeFeed">
        <div className="newsHero card">
          <div className="cardInner">
            <div className="homeHeroTop">
              <img src="/emex_logo.png" alt="EMEX" className="homeHeroLogo" />
              <div className="newsBadge">Главная</div>
            </div>
            <h1 style={{ margin: "8px 0 10px", fontSize: 34, lineHeight: 1.05 }}>Новости компании</h1>
            <div className="muted" style={{ maxWidth: 720, lineHeight: 1.6 }}>
              На главной странице отображаются короткие анонсы публикаций. Полный текст открывается внутри новости.
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

        {loading && <div className="muted">Загрузка новостей...</div>}

        {!loading && !loadError && news.length === 0 && (
          <div className="card">
            <div className="cardInner muted">Пока новостей нет. Создайте первую публикацию через меню пользователя.</div>
          </div>
        )}

        <div className="newsList">
          {news.map((item) => {
            const fullName = `${item.author.first_name} ${item.author.last_name}`;

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
                  </div>

                  <p style={{ margin: "16px 0 10px", fontWeight: 600, lineHeight: 1.6 }}>{item.summary}</p>

                  <div className="row" style={{ marginTop: 16 }}>
                    <Link className="btn btnPrimary" to={`/news/${item.id}`}>
                      Читать новость
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
