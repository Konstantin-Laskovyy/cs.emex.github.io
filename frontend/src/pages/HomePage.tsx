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
