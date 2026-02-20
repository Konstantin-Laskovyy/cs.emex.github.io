import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function Home() {
  const [status, setStatus] = useState("Проверяем API...");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "ok") {
          setStatus("API работает ✅");
        } else {
          setStatus("API ответил странно ⚠️");
        }
      })
      .catch(() => {
        setStatus("API недоступен ❌");
      });
  }, []);

  return (
    <div>
      <h2>Статус</h2>
      <p>{status}</p>
    </div>
  );
}
=======
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export function HomePage() {
  const API_URL = import.meta.env.VITE_API_URL;
  const [apiStatus, setApiStatus] = useState("Проверяем API...");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) =>
        setApiStatus(
          d?.status === "ok"
            ? "API работает ✅"
            : "API ответил странно ⚠️"
        )
      )
      .catch(() => setApiStatus("API недоступен ❌"));
  }, []);

  return (
    <div className="grid2">
      <section className="card">
        <div className="cardInner">
          <h1 style={{ margin: "0 0 8px" }}>Главная</h1>
          <div className="muted" style={{ marginBottom: 14 }}>
            Здесь будет лента новостей/объявлений. В MVP пока показываем быстрые
            действия и системный статус.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <Link className="btn btnPrimary" to="/users">
              Открыть список сотрудников
            </Link>
            <Link className="btn" to="/departments">
              Посмотреть отделы
            </Link>
          </div>
        </div>
      </section>

      <aside className="card">
        <div className="cardInner">
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Статус</h2>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
            - {apiStatus}
            <br />- Авторизация: логин/пароль
            <br />- Данные: PostgreSQL
          </div>
        </div>
      </aside>
    </div>
  );
}