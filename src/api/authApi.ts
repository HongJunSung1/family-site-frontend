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

// 로그인 API 요청
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

// 회원가입 API 요청
export async function signup(payload: SignupPayload) {
  return apiFetch<SignupResponse>("/api/auth/signup", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

// 로그아웃 API 요청
export async function logout() {
  return apiFetch<{ ok: boolean; message?: string }>("/api/auth/logout", {
    method: "POST",
  });
}

// 현재 로그인 사용자 정보 조회
export async function getMe() {
  return apiFetch<MeResponse>("/api/auth/me");
}

// 로컬 저장소 accessToken 조회
export function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

// 로컬 저장소 accessToken 저장
export function storeAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

// 로컬 저장소 accessToken 삭제
export function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// 저장된 accessToken 존재 여부 확인
export function hasStoredAccessToken() {
  return !!getStoredAccessToken();
}

// 로그인 요청과 토큰 저장 통합 처리
export async function loginAndStoreSession(loginId: string, password: string) {
  const data = await login(loginId, password);

  if (!data.ok || !data.accessToken) {
    return data;
  }

  storeAccessToken(data.accessToken);
  return data;
}

// 저장된 토큰의 서버 기준 유효성 확인
export async function verifyStoredSession() {
  if (!hasStoredAccessToken()) return null;

  try {
    return await getMe();
  } catch (error) {
    clearStoredAccessToken();
    throw error;
  }
}

// 서버 로그아웃과 로컬 토큰 정리 통합 처리
export async function logoutAndClearSession() {
  try {
    if (hasStoredAccessToken()) {
      await logout();
    }
  } finally {
    clearStoredAccessToken();
  }
}
