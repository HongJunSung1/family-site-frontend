const API_BASE = import.meta.env.VITE_API_URL || "";

export type ApiErrorData = {
  ok?: boolean;
  message?: string;
};

export class ApiError<TData extends ApiErrorData | null = ApiErrorData | null> extends Error {
  status: number;
  data: TData;

  constructor(status: number, data: TData, message?: string) {
    super(message ?? data?.message ?? "API request failed");
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers, ...requestOptions } = options;
  const token = auth ? localStorage.getItem("accessToken") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers: {
      ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const data = (await res.json().catch(() => null)) as T & ApiErrorData;

  if (!res.ok || data?.ok === false) {
    throw new ApiError(res.status, data, data?.message);
  }

  return data as T;
}

export function hasAccessToken() {
  return !!localStorage.getItem("accessToken");
}

export function isApiBaseConfigured() {
  return !!API_BASE;
}
