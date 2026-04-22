import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { UserPublic } from "../api/types";

type ShellContext = {
  me: UserPublic | null;
};

const featuredNews = [
  {
    id: "news-1",
    tag: "Новости компании",
    title: "Главная страница становится центром внутренних новостей",
    text: "Теперь на главной странице можно публиковать важные объявления, новости подразделений и ключевые обновления по компании вместо технической заглушки.",
    meta: "Сегодня · Продуктовая команда",
  },
  {
    id: "news-2",
    tag: "Инфраструктура",
    title: "Авторизация уже работает через Active Directory",
    text: "Сотрудники могут входить в систему с рабочей учетной записью. Следующий шаг — автоматически подтягивать данные профиля из домена.",
    meta: "Сегодня · IT-отдел",
  },
  {
    id: "news-3",
    tag: "Планы",
    title: "Дальше добавим публикации, комментарии и реакции",
    text: "После запуска новостной ленты можно переходить к полноценной социальной механике: публикациям, обсуждениям и контенту по отделам.",
    meta: "Следующий спринт · Frontend + Backend",
  },
];

export function HomePage() {
  const { me } = useOutletContext<ShellContext>();

  const initials = useMemo(() => {
    if (!me) return "ЕС";
    return `${me.first_name?.[0] ?? ""}${me.last_name?.[0] ?? ""}`.toUpperCase() || "ЕС";
  }, [me]);

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
              Главная страница становится местом для объявлений, внутренних обновлений и важных новостей для всей компании.
            </div>
          </div>
        </div>

        <div className="newsList">
          {featuredNews.map((item) => (
            <article key={item.id} className="card newsCard">
              <div className="cardInner">
                <div className="newsCardTop">
                  <span className="newsTag">{item.tag}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {item.meta}
                  </span>
                </div>
                <h2 style={{ margin: "10px 0 8px", fontSize: 22 }}>{item.title}</h2>
                <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                  {item.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
