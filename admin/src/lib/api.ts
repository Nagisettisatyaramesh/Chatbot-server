const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("aiwa_admin_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("aiwa_admin_token", token);
  else localStorage.removeItem("aiwa_admin_token");
}

async function request<T>(method: string, path: string, body?: unknown, isFormData = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
  });

  if (resp.status === 401) {
    // Clear the token and let AuthProvider handle logging out the React
    // state too (see auth.tsx's "aiwa:unauthorized" listener). Redirecting
    // via window.location.hash directly here, without updating the
    // in-memory auth state, left ProtectedRoute still believing the user
    // was authenticated -- which redirected straight back to the page
    // that just 401'd, causing an infinite request loop.
    setToken(null);
    window.dispatchEvent(new Event("aiwa:unauthorized"));
    throw new ApiRequestError(401, "Session expired, please log in again");
  }

  if (resp.status === 204) return undefined as T;

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ApiRequestError(resp.status, data.error ?? "Request failed");
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, formData: FormData) => request<T>("POST", path, formData, true),
};

export const API_BASE_URL = API_BASE;
