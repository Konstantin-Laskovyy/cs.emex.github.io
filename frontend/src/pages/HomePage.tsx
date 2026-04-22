import { Link, useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { UserPublic } from "../api/types";

type ShellContext = {
  me: UserPublic | null;
};

const featuredNews = [
  {
    id: "news-1",
    tag: "Announcement",
    title: "Corporate news feed is now the center of the homepage",
    text: "The main page becomes a living company space with announcements, product updates, and important internal news instead of a technical placeholder.",
    meta: "Today · Product team",
  },
  {
    id: "news-2",
    tag: "Infrastructure",
    title: "Authorization is now connected to Active Directory",
    text: "Employees can use their work account to sign in. The next step is to enrich local profiles with data from the domain automatically.",
    meta: "Today · IT Department",
  },
  {
    id: "news-3",
    tag: "Roadmap",
    title: "Next up: publishing workflow, comments, and reactions",
    text: "After the first news block lands, we can move on to richer social features and department-driven content on the intranet.",
    meta: "Next sprint · Frontend + Backend",
  },
];

export function HomePage() {
  const API_URL = import.meta.env.VITE_API_URL;
  const [apiStatus, setApiStatus] = useState("Checking API...");
  const { me } = useOutletContext<ShellContext>();

  const initials = useMemo(() => {
    if (!me) return "IS";
    return `${me.first_name?.[0] ?? ""}${me.last_name?.[0] ?? ""}`.toUpperCase() || "IS";
  }, [me]);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((response) => response.json())
      .then((data) => setApiStatus(data?.status === "ok" ? "Online" : "Unexpected response"))
      .catch(() => setApiStatus("Unavailable"));
  }, [API_URL]);

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
                  {me ? `${me.first_name} ${me.last_name}` : "Employee"}
                </div>
                <div className="muted" style={{ fontSize: 14 }}>
                  {me?.title || "Company employee"}
                </div>
              </div>
            </div>

            <div className="quickFacts">
              <div className="quickFact">
                <span className="muted">API</span>
                <strong>{apiStatus}</strong>
              </div>
              <div className="quickFact">
                <span className="muted">Auth</span>
                <strong>Active Directory</strong>
              </div>
              <div className="quickFact">
                <span className="muted">Login</span>
                <strong>{me?.email || "Signed-in user"}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Link className="btn btnPrimary" to="/users">
                Open employees
              </Link>
              <Link className="btn" to="/departments">
                Browse departments
              </Link>
              {me && (
                <Link className="btn" to={`/users/${me.id}`}>
                  Open my profile
                </Link>
              )}
            </div>
          </div>
        </section>
      </aside>

      <section className="homeFeed">
        <div className="newsHero card">
          <div className="cardInner">
            <div className="newsBadge">Home</div>
            <h1 style={{ margin: "8px 0 10px", fontSize: 34, lineHeight: 1.05 }}>Company news</h1>
            <div className="muted" style={{ maxWidth: 720, lineHeight: 1.6 }}>
              The homepage becomes a place for announcements, internal updates, and company-wide communication.
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
