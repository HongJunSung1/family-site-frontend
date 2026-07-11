const API_BASE = import.meta.env.VITE_API_URL || "";

export type ApiErrorData = {
  ok?: boolean;
  message?: string;
};

// API 실패 응답을 상태코드와 응답 데이터로 함께 전달하는 에러
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

// API 공통 fetch 래퍼와 인증 헤더/오류 처리
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

// 현재 브라우저의 accessToken 존재 여부 확인
export function hasAccessToken() {
  return !!localStorage.getItem("accessToken");
}

// API 기본 주소 설정 여부 확인
export function isApiBaseConfigured() {
  return !!API_BASE;
}
