const DEFAULT_API_URL = "https://taam.menu/api";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;

export type ApiError = {
  message?: string;
  detail?: string | any[];
  error?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...Object.fromEntries(
      Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])
    ),
  };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiError = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: await response.text() || response.statusText };
    }
    throw errorData;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "DELETE" }),

  getBlob: async (path: string, options?: RequestInit): Promise<Blob> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...Object.fromEntries(Object.entries(options?.headers || {}).map(([k, v]) => [k, String(v)]))
    };

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      method: "GET",
      headers
    });

    if (!response.ok) {
      throw await response.text();
    }
    return response.blob();
  }
};
