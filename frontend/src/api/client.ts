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

  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (init?.auth !== false) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  const body = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(
      (body as any)?.detail || `Request failed: ${res.status}`,
      res.status,
      body,
    );
  }
  return body as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

