import { apiFetch } from "./client";
import type { ApplyScope, CalEvent, RepeatType } from "../pages/utility/calendar/types";

// 캘린더 관련 API 분리:
// - 내 캘린더 탭 목록 조회: GET /api/auth/myCalendar
// - 일정 목록 조회: GET /api/calendar/events
// - 일정 생성: POST /api/calendar/events
// - 일정 수정: PUT /api/calendar/events/:id
// - 일정 삭제: DELETE /api/calendar/events/:id
// - 캘린더 관리 정보 조회/저장/삭제: /api/calendars/*
// - 캘린더 멤버 상세 조회: GET /api/calendars/getCalendarDetail
// - 캘린더 초대 대상 검색/초대 발송: /api/calendars/:id/invite/*
// - 자주 쓰는 색상 프리셋 조회/저장/삭제: /api/calendars/*ColorPreset*
// - 공휴일 조회: GET /api/holidays

export type MyCalendar = {
  calendarId: number;
  name: string;
  role: string;
  isDefault: number;
};

type MyCalendarsResponse = {
  ok: boolean;
  calendars?: MyCalendar[];
  message?: string;
};

type CalendarEventsResponse = {
  ok: boolean;
  events?: ServerCalendarEvent[];
  exceptions?: ServerCalendarException[];
  overrides?: ServerCalendarOverride[];
  message?: string;
};

type CalendarMutationResponse = {
  ok: boolean;
  message?: string;
};

export type CalendarInfoItem = {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  user_id: number;
  role: string;
  tab_order: number | null;
};

export type CalendarMemberItem = {
  no: number;
  user_id: number;
  role: string;
  joined_at: string;
  name: string;
  email: string;
  total_count: number;
};

export type CalendarDetailResponse = {
  ok: boolean;
  calendar: {
    id: number;
    name: string;
    owner_id: number;
    created_at: string;
  };
  members: CalendarMemberItem[];
  message?: string;
};

export type GetMyCalendarsInfoResponse = {
  ok: boolean;
  calendars: CalendarInfoItem[];
  defaultCalendarId: number | null;
  message?: string;
};

export type CalendarInfoPayloadItem = {
  calendarId: number;
  name: string;
  tabOrder: number | null;
};

export type SaveMyCalendarsInfoPayload = {
  defaultCalendarId: number | null;
  newCalendarMain: boolean;
  calendars: CalendarInfoPayloadItem[];
};

export type SaveMyCalendarsInfoResponse = {
  ok: boolean;
  message?: string;
};

export type DeleteMyCalendarResponse = {
  ok: boolean;
  message?: string;
  deletedCalendarId?: number;
  nextDefaultCalendarId?: number | null;
};

export type InviteSearchUser = {
  id: number;
  login_id: string;
  email: string;
  name: string | null;
};

export type InviteSearchUsersResponse = {
  ok: boolean;
  users?: InviteSearchUser[];
  message?: string;
};

export type InviteCalendarResponse = {
  ok: boolean;
  message?: string;
};

export type FavoriteColorPreset = {
  slot: number;
  color: string;
  label: string | null;
};

export type GetColorPresetsResponse = {
  ok: boolean;
  presets?: FavoriteColorPreset[];
  message?: string;
};

export type SaveColorPresetsResponse = {
  ok: boolean;
  message?: string;
};

export type HolidayItem = {
  date: string;
  name?: string;
};

export type HolidaysResponse = {
  ok: boolean;
  holidays?: HolidayItem[];
  message?: string;
};

type ServerCalendarEvent = {
  id: number;
  title: string;
  start_at: string;
  end_at?: string;
  all_day?: number | boolean;
  memo?: string | null;
  color?: string | null;
  created_by: number | string;
  created_by_name?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  repeat_type?: RepeatType | null;
  repeat_interval?: number | null;
  repeat_range_start?: string | null;
  repeat_range_end?: string | null;
  repeat_anchor_dom?: number | null;
};

type ServerCalendarException = {
  event_id: number;
  occ_key: string;
};

type ServerCalendarOverride = {
  event_id: number;
  occ_key: string;
  title?: string | null;
  memo?: string | null;
  color?: string | null;
  all_day?: number | boolean | null;
  start_at?: string | null;
  end_at?: string | null;
};

export type CalendarEventPayload = {
  calendarId?: number;
  title: string;
  memo: string;
  color: string;
  allDay: boolean;
  startAt: string;
  endAt: string;
  locationName: string;
  locationAddress: string;
  locationLat: number | null;
  locationLng: number | null;
  repeatType: RepeatType;
  repeatInterval: number;
  repeatRangeStart: string;
  repeatRangeEnd: string;
  multiDates?: string[];
  repeatAnchorDom: number | null;
};

export type UpdateCalendarEventPayload = Omit<CalendarEventPayload, "calendarId" | "multiDates"> & {
  scope: ApplyScope;
  occKey: string;
};

export type DeleteCalendarEventPayload = {
  scope: ApplyScope;
  occKey: string;
};

export async function getMyCalendars() {
  const data = await apiFetch<MyCalendarsResponse>("/api/auth/myCalendar");
  return data.calendars ?? [];
}

export async function getCalendarEvents(calendarId: number) {
  const data = await apiFetch<CalendarEventsResponse>(`/api/calendar/events?calendarId=${calendarId}`);
  return toCalendarEvents(data);
}

export async function createCalendarEvent(payload: CalendarEventPayload) {
  return apiFetch<CalendarMutationResponse>("/api/calendar/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCalendarEvent(eventId: number, payload: UpdateCalendarEventPayload) {
  return apiFetch<CalendarMutationResponse>(`/api/calendar/events/${eventId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCalendarEvent(eventId: number, payload: DeleteCalendarEventPayload) {
  return apiFetch<CalendarMutationResponse>(`/api/calendar/events/${eventId}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export async function getMyCalendarsInfo() {
  return apiFetch<GetMyCalendarsInfoResponse>("/api/calendars/getMyCalendarsInfo");
}

export async function saveMyCalendarsInfo(payload: SaveMyCalendarsInfoPayload) {
  return apiFetch<SaveMyCalendarsInfoResponse>("/api/calendars/saveMyCalendarsInfo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteMyCalendar(calendarId: number) {
  return apiFetch<DeleteMyCalendarResponse>(`/api/calendars/${calendarId}`, {
    method: "DELETE",
  });
}

export async function getCalendarDetail(calendarId: number) {
  return apiFetch<CalendarDetailResponse>(`/api/calendars/getCalendarDetail?calendarId=${calendarId}`);
}

export async function searchCalendarInviteUsers(calendarId: number, keyword: string) {
  return apiFetch<InviteSearchUsersResponse>(
    `/api/calendars/${calendarId}/invite/search-users?keyword=${encodeURIComponent(keyword)}`
  );
}

export async function inviteCalendarUsers(calendarId: number, inviteeIds: number[]) {
  return apiFetch<InviteCalendarResponse>(`/api/calendars/${calendarId}/invite`, {
    method: "POST",
    body: JSON.stringify({ inviteeIds }),
  });
}

export async function getMyColorPresets() {
  return apiFetch<GetColorPresetsResponse>("/api/calendars/getMyColorPresets");
}

export async function saveMyColorPresets(presets: FavoriteColorPreset[]) {
  return apiFetch<SaveColorPresetsResponse>("/api/calendars/saveMyColorPresets", {
    method: "POST",
    body: JSON.stringify({ presets }),
  });
}

export async function deleteMyColorPreset(slot: number) {
  return apiFetch<{ ok: boolean; message?: string }>("/api/calendars/deleteMyColorPreset", {
    method: "POST",
    body: JSON.stringify({ slot }),
  });
}

export async function getHolidays(year: number) {
  return apiFetch<HolidaysResponse>(`/api/holidays?year=${year}`, {
    auth: false,
  });
}

function toCalendarEvents(data: CalendarEventsResponse): CalEvent[] {
  const exceptionsById: Record<number, string[]> = {};
  for (const ex of data.exceptions ?? []) {
    (exceptionsById[ex.event_id] ||= []).push(ex.occ_key);
  }

  const overridesById: Record<number, ServerCalendarOverride[]> = {};
  for (const ov of data.overrides ?? []) {
    (overridesById[ov.event_id] ||= []).push(ov);
  }

  return (data.events ?? []).map((event) => ({
    id: String(event.id),
    title: event.title,
    start: event.start_at,
    end: event.end_at,
    allDay: !!event.all_day,
    memo: event.memo ?? "",
    color: event.color ?? "#1e2a78",
    createdBy: String(event.created_by),
    createdByName: event.created_by_name ?? "",
    locationName: event.location_name ?? "",
    locationAddress: event.location_address ?? "",
    locationLat: event.location_lat ?? null,
    locationLng: event.location_lng ?? null,
    repeat: event.repeat_type ?? "none",
    repeatInterval: event.repeat_interval ?? 1,
    repeatRangeStart: event.repeat_range_start ?? "",
    repeatRangeEnd: event.repeat_range_end ?? "",
    repeatAnchorDom: event.repeat_anchor_dom ?? null,
    repeatExceptions: exceptionsById[event.id] ?? [],
    repeatOverrides: Object.fromEntries(
      (overridesById[event.id] ?? []).map((override) => [
        override.occ_key,
        {
          title: override.title ?? undefined,
          memo: override.memo ?? undefined,
          color: override.color ?? undefined,
          allDay: override.all_day == null ? undefined : !!override.all_day,
          start: override.start_at ?? undefined,
          end: override.end_at ?? undefined,
        },
      ])
    ),
  }));
}
