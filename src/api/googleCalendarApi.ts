import { apiFetch } from "./client";

const BASE = "/api/google-calendar";
export type GoogleCalendarStatus = {
  ok: true;
  ready: boolean;
  environment: "local" | "production";
  redirectUri: string;
  message: string;
  connection: {
    email: string;
  } | null;
  mappings: { site_calendar_id: number; google_calendar_id: string; google_calendar_name: string;
    sync_enabled?: number; sync_initialized?: number; sync_mode?:string; mode_started_at?:string|null; last_synced_at?: string | null; last_error?: string | null; review_count?: number; pending_count?: number }[];
};
export type GoogleCalendarChoice = { id: string; summary: string; primary?: boolean };
export const getGoogleCalendarStatus = () => apiFetch<GoogleCalendarStatus>(`${BASE}/status`);
export const listGoogleCalendars = () => apiFetch<{ ok: true; calendars: GoogleCalendarChoice[] }>(`${BASE}/calendars`);
export const saveGoogleCalendarSelection = (googleCalendarId: string | null, siteCalendarId: number) =>
  apiFetch<{ ok: true }>(`${BASE}/selection`, { method: "PUT", body: JSON.stringify({ googleCalendarId, siteCalendarId }) });
export const disconnectGoogleCalendar = () => apiFetch<{ ok: true }>(`${BASE}/connection`, { method: "DELETE" });

export async function connectGoogleCalendar() {
  const result = await apiFetch<{ ok: true; authorizationUrl: string; ticket: string; state: string }>(`${BASE}/connect`, {
    method: "POST", body: JSON.stringify({ returnOrigin: window.location.origin }),
  });
  // 최상위 POST + Origin 검증으로 연결을 시작한 사이트와 브라우저를 바인딩한다.
  const form = document.createElement("form");
  form.method = "POST";
  form.action = result.authorizationUrl;
  for (const [name, value] of Object.entries({ ticket: result.ticket, state: result.state })) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
