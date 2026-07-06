import { apiFetch } from "./client";

const ACCESS_TOKEN_KEY = "accessToken";

// 인증 관련 API:
// - 로그인: POST /api/auth/login
// - 회원가입: POST /api/auth/signup
// - 로그아웃: POST /api/auth/logout
// - 현재 로그인 상태/사용자 정보 조회: GET /api/auth/me

export type LoginResponse = {
  ok: boolean;
  accessToken?: string;
  user?: { id: number; email: string; name: string | null };
  message?: string;
};

export type SignupPayload = {
  name: string;
  id: string;
  email: string;
  password: string;
};

export type SignupResponse = {
  ok: boolean;
  message?: string;
};

export type MeResponse = {
  ok: boolean;
  user?: { id: number; email: string; name: string | null };
  defaultCalendarId?: number | null;
  calendarRole?: string | null;
  message?: string;
};

export async function login(loginId: string, password: string) {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      login_id: loginId,
      password,
    }),
  });
}

export async function signup(payload: SignupPayload) {
  return apiFetch<SignupResponse>("/api/auth/signup", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return apiFetch<{ ok: boolean; message?: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getMe() {
  return apiFetch<MeResponse>("/api/auth/me");
}

export function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function hasStoredAccessToken() {
  return !!getStoredAccessToken();
}

// 로그인 요청과 토큰 저장을 하나의 흐름으로 묶는다.
export async function loginAndStoreSession(loginId: string, password: string) {
  const data = await login(loginId, password);

  if (!data.ok || !data.accessToken) {
    return data;
  }

  storeAccessToken(data.accessToken);
  return data;
}

// 저장된 토큰이 실제로 유효한지 서버 기준으로 확인한다.
export async function verifyStoredSession() {
  if (!hasStoredAccessToken()) return null;

  try {
    return await getMe();
  } catch (error) {
    clearStoredAccessToken();
    throw error;
  }
}

// 서버 로그아웃과 로컬 토큰 정리를 한 번에 처리한다.
export async function logoutAndClearSession() {
  try {
    if (hasStoredAccessToken()) {
      await logout();
    }
  } finally {
    clearStoredAccessToken();
  }
}
