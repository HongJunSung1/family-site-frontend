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

export async function getPersonalInfo() {
  return apiFetch<PersonalInfoResponse>("/api/auth/personalInfo");
}

export async function updateProfile(payload: { name: string; email: string }) {
  return apiFetch<UpdateProfileResponse>("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
