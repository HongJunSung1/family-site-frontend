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

// 인증 헤더를 적용한 원본 API 응답 반환
export async function apiFetchResponse(path: string, options: ApiFetchOptions = {}) {
  const { auth = true, headers, ...requestOptions } = options;
  const token = auth ? localStorage.getItem("accessToken") : null;
  const isFormData = requestOptions.body instanceof FormData;

  return fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers: {
      ...(requestOptions.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}

// API 공통 fetch 래퍼와 JSON 오류 처리
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetchResponse(path, options);

  const data = (await res.json().catch(() => null)) as T & ApiErrorData;

  if (!res.ok || data?.ok === false) {
    throw new ApiError(res.status, data, data?.message);
  }

  return data as T;
}

// multipart 업로드 진행률과 JSON 응답을 함께 처리
export function apiUpload<T>(
  path: string,
  body: FormData,
  onProgress?: (percentage: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const token = localStorage.getItem("accessToken");
    request.open("POST", `${API_BASE}${path}`);
    request.timeout = 120_000;
    if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    request.addEventListener("load", () => {
      const data = (() => {
        try {
          return JSON.parse(request.responseText) as T & ApiErrorData;
        } catch {
          return null;
        }
      })();
      if (request.status < 200 || request.status >= 300 || data?.ok === false) {
        reject(new ApiError(request.status, data, data?.message));
        return;
      }
      if (!data) {
        reject(new ApiError(request.status, null, "업로드 응답을 확인할 수 없습니다."));
        return;
      }
      resolve(data as T);
    });
    request.addEventListener("error", () => reject(new ApiError(0, null, "업로드 서버에 연결할 수 없습니다.")));
    request.addEventListener("timeout", () => reject(new ApiError(0, null, "업로드 응답 시간이 초과되었습니다.")));
    request.send(body);
  });
}

// 현재 브라우저의 accessToken 존재 여부 확인
export function hasAccessToken() {
  return !!localStorage.getItem("accessToken");
}

// API 기본 주소 설정 여부 확인
export function isApiBaseConfigured() {
  return !!API_BASE;
}
