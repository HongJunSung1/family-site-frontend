import { apiFetch } from "./client";

// 알림 관련 API 분리:
// - 최근 알림 목록 조회: GET /api/notifications
// - 알림 읽음 처리: POST /api/notifications/:id/read
// - 알림 히스토리 조회: GET /api/notifications/history
// - 캘린더 초대 수락/거절: POST /api/calendar-invitations/:id/respond

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  ref_id: number | null;
  is_read: number;
  status: string;
  created_at: string;
  invitation_status?: string | null;
};

export type NotificationRow = NotificationItem & {
  read_at?: string | null;
  expires_at?: string | null;
  calendar_name?: string | null;
  inviter_name?: string | null;
};

export type NotificationsResponse = {
  ok: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  message?: string;
};

export type NotificationHistoryResponse = {
  ok: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  notifications: NotificationRow[];
  message?: string;
};

export type InvitationAction = "accept" | "reject";

export async function getNotifications() {
  return apiFetch<NotificationsResponse>("/api/notifications");
}

export async function markNotificationRead(notificationId: number) {
  return apiFetch<{ ok: boolean; message?: string }>(`/api/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export async function getNotificationHistory(page: number) {
  return apiFetch<NotificationHistoryResponse>(`/api/notifications/history?page=${page}`);
}

export async function respondCalendarInvitation(invitationId: number, action: InvitationAction) {
  return apiFetch<{ ok: boolean; message?: string }>(`/api/calendar-invitations/${invitationId}/respond`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
