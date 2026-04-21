export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function getApiBaseUrl() {
  return (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";
}

export function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("access_token");
  else localStorage.setItem("access_token", token);
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (init?.auth !== false) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    const text = await res.text();
    const body = text ? safeJsonParse(text) : undefined;

    if (!res.ok) {
      throw new ApiError(
        getErrorMessage(body, res.status),
        res.status,
        body,
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "API недоступно. Для входа нужен запущенный backend или опубликованный публичный API.",
        504,
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(body: unknown, status: number) {
  const detail = (body as any)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || JSON.stringify(item))
      .filter(Boolean)
      .join("; ");
  }
  if (typeof body === "string" && body) return body;
  return `Request failed: ${status}`;
}

