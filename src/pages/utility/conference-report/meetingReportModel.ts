import type {
  ActionStatus,
  AgendaPriority,
  AgendaStatus,
  AttendanceStatus,
  MeetingActionItem,
  MeetingAgenda,
  MeetingComment,
  MeetingDiscussion,
  MeetingParticipant,
  MeetingReport,
  MeetingStatus,
  MeetingType,
} from "../../../api/meetingApi";

export type MemberOption = { id: number; name: string };

export type MeetingForm = {
  calendarId: number;
  title: string;
  meetingType: MeetingType;
  meetingAt: string;
  location: string;
  memo: string;
  status: MeetingStatus;
};

export type DetailState = {
  meeting: MeetingReport;
  participants: MeetingParticipant[];
  agendas: MeetingAgenda[];
  discussions: MeetingDiscussion[];
  actionItems: MeetingActionItem[];
  comments: MeetingComment[];
  canEdit: boolean;
  currentUserId: number;
};

export type ActionDraft = {
  content: string;
  managerId: number | null;
  dueStartDate: string;
  dueEndDate: string;
  status: ActionStatus;
  calendarColor: string;
};

export type PendingMeetingNavigation =
  | { type: "new" }
  | { type: "meeting"; meetingId: number }
  | { type: "calendar"; calendarId: number }
  | { type: "route"; path: string };

export const meetingTypeLabels: Record<MeetingType, string> = {
  regular: "정기회의",
  urgent: "긴급회의",
  temporary: "임시회의",
};

export const meetingStatusLabels: Record<MeetingStatus, string> = {
  in_progress: "진행중",
  closed: "종료",
};

export const agendaPriorityLabels: Record<AgendaPriority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

export const agendaStatusLabels: Record<AgendaStatus, string> = {
  waiting: "대기",
  discussing: "논의중",
  decided: "결정",
  pending: "보류",
};

export const actionStatusLabels: Record<ActionStatus, string> = {
  todo: "진행중",
  done: "완료",
  hold: "보류",
};

export const attendanceLabels: Record<AttendanceStatus, string> = {
  expected: "예정",
  present: "참석",
  absent: "불참",
  late: "지각",
};

export const COMMENT_MAX_LENGTH = 100;
export const COMMENT_PAGE_SIZE = 5;

// 회의록 API 오류를 사용자 안내 문구로 변환
export function getMeetingErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.";
  }
  if (error instanceof Error && error.message && error.message !== "API request failed") {
    return error.message;
  }
  return fallback;
}

// 할 일 입력 행에 저장할 내용이 있는지 확인
export function hasActionDraftValue(draft: ActionDraft) {
  return !!draft.content.trim() || draft.managerId !== null || !!draft.dueStartDate || !!draft.dueEndDate;
}

// 새 회의 기본 일시 생성
export function getDefaultMeetingAt() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

// 회의 일시 화면 표시 형식 변환
export function formatDateTime(value: string) {
  return value ? value.replace("T", " ") : "-";
}

// 회의록 변경 후 캘린더 일정 재조회 신호 전달
export function notifyCalendarEventsChanged() {
  window.dispatchEvent(new CustomEvent("family-calendar-events-changed"));
}

// 할 일을 캘린더에 저장할 수 있는 필수값 확인
export function canSyncActionToCalendar(action: MeetingActionItem) {
  return !!action.manager_id && !!action.content.trim() && !!action.due_start_date && !!action.due_end_date;
}

// 편집 중인 할 일을 캘린더에 저장할 수 있는 필수값 확인
export function canSyncActionDraftToCalendar(action: ActionDraft) {
  return !!action.managerId && !!action.content.trim() && !!action.dueStartDate && !!action.dueEndDate;
}

// 할 일 캘린더 색상 기본값 반환
export function getActionCalendarColor(action: MeetingActionItem | ActionDraft) {
  if ("calendar_color" in action) return action.calendar_color || "#56c7a5";
  return action.calendarColor || "#56c7a5";
}

// 숫자 입력을 YYYY-MM-DD 형태로 정리
export function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}
