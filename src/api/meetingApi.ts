import { ApiError, apiFetch, apiFetchResponse, apiUpload, type ApiErrorData } from "./client";

export type MeetingType = "regular" | "urgent" | "temporary";
export type MeetingStatus = "in_progress" | "closed";
export type AgendaPriority = "high" | "normal" | "low";
export type AgendaStatus = "waiting" | "discussing" | "decided" | "pending";
export type ActionStatus = "todo" | "done" | "hold";
export type AttendanceStatus = "expected" | "present" | "absent" | "late";

export type MeetingListItem = {
  id: number;
  calendar_id: number;
  calendar_name: string;
  title: string;
  meeting_type: MeetingType;
  meeting_at: string;
  location: string;
  status: MeetingStatus;
  agenda_count: number;
  action_count: number;
  updated_at: string;
};

export type MeetingReport = {
  id: number;
  calendar_id: number;
  calendar_event_id: number | null;
  created_by: number;
  title: string;
  meeting_type: MeetingType;
  meeting_at: string;
  location: string;
  memo: string;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
};

export type MeetingParticipant = {
  user_id: number;
  attendance_status: AttendanceStatus;
  name: string | null;
  email: string;
};

export type MeetingAgenda = {
  id: number;
  meeting_id: number;
  created_by: number | null;
  title: string;
  manager_id: number | null;
  manager_name: string | null;
  priority: AgendaPriority;
  status: AgendaStatus;
  sort_order: number;
  attachment_count: number;
};

export type MeetingDiscussion = {
  id: number;
  agenda_id: number;
  discussion: string;
  decision: string;
  sort_order: number;
};

export type MeetingActionItem = {
  id: number;
  agenda_id: number;
  discussion_id: number | null;
  manager_id: number | null;
  calendar_event_id: number | null;
  calendar_color: string;
  manager_name: string | null;
  content: string;
  due_start_date: string;
  due_end_date: string;
  status: ActionStatus;
};

export type MeetingComment = {
  id: number;
  agenda_id: number;
  created_by: number;
  author_name: string | null;
  author_email: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type MeetingAttachment = {
  id: number;
  meetingId: number;
  agendaId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
  uploadedAt: string;
  uploaderName: string;
};

export type MeetingPayload = {
  calendarId: number;
  title: string;
  meetingType: MeetingType;
  meetingAt: string;
  location: string;
  memo: string;
  status: MeetingStatus;
  participantIds?: number[];
};

export type AgendaPayload = {
  title: string;
  managerId: number | null;
  priority: AgendaPriority;
  status: AgendaStatus;
  sortOrder: number;
};

export type DiscussionPayload = {
  discussion: string;
  decision: string;
  sortOrder: number;
};

export type ActionItemPayload = {
  discussionId?: number | null;
  managerId: number | null;
  content: string;
  dueStartDate: string;
  dueEndDate: string;
  status: ActionStatus;
  calendarColor?: string;
};

export type CommentPayload = {
  content: string;
};

type MeetingsResponse = {
  ok: boolean;
  meetings?: MeetingListItem[];
  message?: string;
};

type MeetingDetailResponse = {
  ok: boolean;
  meeting: MeetingReport;
  participants: MeetingParticipant[];
  agendas: MeetingAgenda[];
  discussions: MeetingDiscussion[];
  actionItems: MeetingActionItem[];
  comments: MeetingComment[];
  canEdit: boolean;
  currentUserId: number;
  message?: string;
};

type MutationResponse = {
  ok: boolean;
  meetingId?: number;
  agendaId?: number;
  discussionId?: number;
  actionItemId?: number;
  commentId?: number;
  calendarEventId?: number;
  message?: string;
};

type MeetingAttachmentsResponse = {
  ok: boolean;
  attachments?: MeetingAttachment[];
  attachment?: MeetingAttachment;
  message?: string;
};

// 회의 목록 조회
export async function getMeetings(params: {
  calendarId?: number;
  keyword?: string;
  from?: string;
  to?: string;
} = {}) {
  const search = new URLSearchParams();
  if (params.calendarId) search.set("calendarId", String(params.calendarId));
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);

  const data = await apiFetch<MeetingsResponse>(`/api/meetings${search.toString() ? `?${search}` : ""}`);
  return data.meetings ?? [];
}

// 회의 상세 조회
export function getMeetingDetail(meetingId: number) {
  return apiFetch<MeetingDetailResponse>(`/api/meetings/${meetingId}`);
}

// 회의 생성
export function createMeeting(payload: MeetingPayload) {
  return apiFetch<MutationResponse>("/api/meetings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 회의 기본 정보 수정
export function updateMeeting(meetingId: number, payload: MeetingPayload) {
  return apiFetch<MutationResponse>(`/api/meetings/${meetingId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 회의 삭제
export function deleteMeeting(meetingId: number) {
  return apiFetch<MutationResponse>(`/api/meetings/${meetingId}`, {
    method: "DELETE",
  });
}

// 참석자 상태 저장
export function saveMeetingParticipants(
  meetingId: number,
  participants: Array<{ userId: number; attendanceStatus: AttendanceStatus }>
) {
  return apiFetch<MutationResponse>(`/api/meetings/${meetingId}/participants`, {
    method: "POST",
    body: JSON.stringify({ participants }),
  });
}

// 안건 생성
export function createMeetingAgenda(meetingId: number, payload: AgendaPayload) {
  return apiFetch<MutationResponse>(`/api/meetings/${meetingId}/agendas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 안건 수정
export function updateMeetingAgenda(agendaId: number, payload: AgendaPayload) {
  return apiFetch<MutationResponse>(`/api/meeting-agendas/${agendaId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 안건 삭제
export function deleteMeetingAgenda(agendaId: number) {
  return apiFetch<MutationResponse>(`/api/meeting-agendas/${agendaId}`, {
    method: "DELETE",
  });
}

// 논의/결정 생성
export function createMeetingDiscussion(agendaId: number, payload: DiscussionPayload) {
  return apiFetch<MutationResponse>(`/api/meeting-agendas/${agendaId}/discussions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 논의/결정 수정
export function updateMeetingDiscussion(discussionId: number, payload: DiscussionPayload) {
  return apiFetch<MutationResponse>(`/api/meeting-discussions/${discussionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 논의/결정 삭제
export function deleteMeetingDiscussion(discussionId: number) {
  return apiFetch<MutationResponse>(`/api/meeting-discussions/${discussionId}`, {
    method: "DELETE",
  });
}

// 할 일 생성
// 안건 댓글 생성
export function createMeetingComment(agendaId: number, payload: CommentPayload) {
  return apiFetch<MutationResponse>(`/api/meeting-agendas/${agendaId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 안건 댓글 수정
export function updateMeetingComment(commentId: number, payload: CommentPayload) {
  return apiFetch<MutationResponse>(`/api/meeting-comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 안건 댓글 삭제
export function deleteMeetingComment(commentId: number) {
  return apiFetch<MutationResponse>(`/api/meeting-comments/${commentId}`, {
    method: "DELETE",
  });
}

export function createMeetingActionItem(agendaId: number, payload: ActionItemPayload) {
  return apiFetch<MutationResponse>(`/api/meeting-agendas/${agendaId}/action-items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 할 일 수정
export function updateMeetingActionItem(actionItemId: number, payload: ActionItemPayload) {
  return apiFetch<MutationResponse>(`/api/meeting-action-items/${actionItemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 할 일 삭제
export function deleteMeetingActionItem(actionItemId: number) {
  return apiFetch<MutationResponse>(`/api/meeting-action-items/${actionItemId}`, {
    method: "DELETE",
  });
}

// 할 일을 캘린더 일정으로 생성/갱신
export function syncMeetingActionItemToCalendar(actionItemId: number) {
  return apiFetch<MutationResponse>(`/api/meeting-action-items/${actionItemId}/calendar-event`, {
    method: "POST",
  });
}

// 안건 첨부파일 목록 조회
export async function getMeetingAttachments(agendaId: number) {
  const data = await apiFetch<MeetingAttachmentsResponse>(`/api/meeting-agendas/${agendaId}/attachments`);
  return data.attachments ?? [];
}

// 안건 첨부파일 업로드
export function uploadMeetingAttachment(agendaId: number, file: File, onProgress?: (percentage: number) => void) {
  const formData = new FormData();
  formData.set("file", file);
  return apiUpload<MeetingAttachmentsResponse>(`/api/meeting-agendas/${agendaId}/attachments`, formData, onProgress);
}

// 첨부파일 다운로드 응답 조회
export async function downloadMeetingAttachment(attachmentId: number) {
  const response = await apiFetchResponse(`/api/meeting-attachments/${attachmentId}/download`);
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as ApiErrorData | null;
    throw new ApiError(response.status, data, data?.message);
  }
  return response.blob();
}

// 첨부파일 삭제
export function deleteMeetingAttachment(attachmentId: number) {
  return apiFetch<MutationResponse>(`/api/meeting-attachments/${attachmentId}`, {
    method: "DELETE",
  });
}
