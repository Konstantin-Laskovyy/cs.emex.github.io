import { Link } from "react-router-dom";

export function HomePage() {
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
            - API: будет показываться health-check\n
            <br />- Авторизация: логин/пароль\n
            <br />- Данные: PostgreSQL\n
          </div>
        </div>
      </aside>
    </div>
  );
}

