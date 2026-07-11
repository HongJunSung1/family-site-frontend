import { apiFetch } from "./client";

// 사용자 정보 관련 API 분리:
// - 개인 기본정보 조회: GET /api/auth/personalInfo
// - 프로필 수정: PUT /api/auth/profile

export type PersonalInfoUser = {
  login_id: string;
  email: string;
  name: string | null;
  created_at: string;
  defaultCalendarId: number | null;
};

export type PersonalInfoResponse = {
  ok: boolean;
  user: PersonalInfoUser;
  defaultCalendarId: number | null;
  calendarRole: string | null;
  message?: string;
};

export type UpdateProfileResponse = {
  ok: boolean;
  message?: string;
  user?: PersonalInfoUser;
};

// 개인정보 기본 정보 조회
export async function getPersonalInfo() {
  return apiFetch<PersonalInfoResponse>("/api/auth/personalInfo");
}

// 개인정보 이름/이메일 수정 요청
export async function updateProfile(payload: { name: string; email: string }) {
  return apiFetch<UpdateProfileResponse>("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
