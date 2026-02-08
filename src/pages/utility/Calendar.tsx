import React, { useMemo, useRef, useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";

import type { CalEvent, FormState, ModalMode, PickerTarget } from "./calendar/types";
import { useHolidays } from "./calendar/hooks/useHolidays";
import { CalendarView } from "./calendar/components/CalendarView";
import { EventModal } from "./calendar/components/EventModal";

import { addHours, formatISO, pad2, toDayjs } from "./calendar/utils/date";
import { expandRecurringEvents } from "./calendar/utils/recurrence";

const API_BASE = import.meta.env.VITE_API_URL || "";
dayjs.locale("ko");

type MeResponse = {
  ok: boolean;
  user?: { id: number; email: string; name: string | null };
  defaultCalendarId?: number | null;
  calendarRole?: string | null;
  message?: string;
};

const Calendar: React.FC = () => {
  const calRef = useRef<FullCalendar | null>(null);

  const [formError, setFormError] = useState<string>("");

  const [holidayYear, setHolidayYear] = useState<number>(dayjs().year());
  const { holidaySet, holidayMap } = useHolidays(API_BASE, holidayYear);

  const [events, setEvents] = useState<CalEvent[]>([]);

  const [mode, setMode] = useState<ModalMode>("none");
  const [picker, setPicker] = useState<PickerTarget>("none");

  // ✅ 로그인/캘린더 정보
  const [userId, setUserId] = useState<string>("");                 // createdBy 비교용
  const [calendarId, setCalendarId] = useState<number | null>(null); // 이제 여기서만 관리

  const [form, setForm] = useState<FormState>({
    id: "",
    title: "",
    start: "",
    end: "",
    memo: "",
    repeat: "none",
    repeatInterval: 1,
    repeatRangeStart: "",
    repeatRangeEnd: "",
    repeatSnap: { repeat: "none", repeatInterval: 1, repeatRangeStart: "", repeatRangeEnd: "" },
    multiDates: [],
    color: "#1e2a78",
    createdBy: "",
    allDay: false,
    prevStartTime: "09:00",
    prevEndTime: "10:00",
    clickedOccKey: "",
    applyScope: "this",
  });

  const [viewRange, setViewRange] = useState<{ start: Dayjs; end: Dayjs }>(() => {
    const now = dayjs();
    return { start: now.startOf("month"), end: now.endOf("month").add(1, "day") };
  });

  // ✅ /api/auth/me 로 userId + defaultCalendarId 가져오기
  useEffect(() => {
    console.log("✅ [ME] effect mounted");
    (async () => {
      const token = localStorage.getItem("accessToken");
      console.log("✅ [ME] token exists?", !!token); // (2)
      if (!token) {
        setFormError("로그인이 필요합니다.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
       console.log("✅ [ME] status:", res.status); // (3)
      const data = (await res.json().catch(() => null)) as MeResponse | null;
       console.log("📦 [ME] raw:", data); // (4) 제일 중요
      if (!res.ok || !data?.ok) {
        setFormError(data?.message ?? "로그인 정보를 불러오지 못했습니다.");
        return;
      }

      const uid = String(data.user?.id ?? "");
      setUserId(uid);
      
      const cid = data.defaultCalendarId ?? null;
      setCalendarId(cid);
      console.log("📅 [ME] parsed calendarId:", cid, "typeof:", typeof cid); // (5)

      if (!cid) {
        setFormError("이 계정은 가입된 캘린더가 없습니다. (calendar_members 확인 필요)");
      }
    })();
  }, []);

  const loadEvents = React.useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    if (!calendarId) return;

    const res = await fetch(`${API_BASE}/api/calendar/events?calendarId=${calendarId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      // 403이면 멤버십 문제
      if (res.status === 403) setFormError("이 캘린더에 대한 권한이 없습니다. (calendar_members 확인)");
      return;
    }

    const exceptionsById: Record<number, string[]> = {};
    for (const ex of data.exceptions ?? []) {
      (exceptionsById[ex.event_id] ||= []).push(ex.occ_key);
    }

    const overridesById: Record<number, any[]> = {};
    for (const ov of data.overrides ?? []) {
      (overridesById[ov.event_id] ||= []).push(ov);
    }

    const next: CalEvent[] = (data.events ?? []).map((e: any) => ({
      id: String(e.id),
      title: e.title,
      start: e.start_at,
      end: e.end_at,
      allDay: !!e.all_day,
      memo: e.memo ?? "",
      color: e.color ?? "#1e2a78",
      createdBy: String(e.created_by),

      repeat: e.repeat_type ?? "none",
      repeatInterval: e.repeat_interval ?? 1,
      repeatRangeStart: e.repeat_range_start ?? "",
      repeatRangeEnd: e.repeat_range_end ?? "",
      repeatAnchorDom: e.repeat_anchor_dom ?? null,

      repeatExceptions: exceptionsById[e.id] ?? [],
      repeatOverrides: Object.fromEntries(
        (overridesById[e.id] ?? []).map((o: any) => [
          o.occ_key,
          {
            title: o.title ?? undefined,
            memo: o.memo ?? undefined,
            color: o.color ?? undefined,
            allDay: o.all_day == null ? undefined : !!o.all_day,
            start: o.start_at ?? undefined,
            end: o.end_at ?? undefined,
          },
        ])
      ),
    }));

    setEvents(next);
  }, [calendarId]);

  useEffect(() => {
    // calendarId가 세팅된 뒤에만 호출
    if (calendarId) loadEvents();
  }, [calendarId, loadEvents]);

  const expandedEvents = useMemo(
    () => expandRecurringEvents(events, viewRange.start, viewRange.end),
    [events, viewRange.start, viewRange.end]
  );

  const getDayType = React.useCallback(
    (d: Dayjs) => {
      const dow = d.day();
      const isHol = holidaySet.has(d.format("YYYY-MM-DD"));
      if (isHol || dow === 0) return "red";
      if (dow === 6) return "blue";
      return "black";
    },
    [holidaySet]
  );

  const closeModal = () => {
    setFormError("");
    setPicker("none");
    setMode("none");
  };

  const ensureOrderAfterStartChange = (nextStart: Dayjs, currentEnd: Dayjs) => {
    if (nextStart.isAfter(currentEnd)) return { start: nextStart, end: addHours(nextStart, 1) };
    return { start: nextStart, end: currentEnd };
  };

  const ensureOrderAfterEndChange = (currentStart: Dayjs, nextEnd: Dayjs) => {
    if (nextEnd.isBefore(currentStart)) return { start: addHours(nextEnd, -1), end: nextEnd };
    return { start: currentStart, end: nextEnd };
  };

  const clampFollowingStart = (p: FormState, nextStart: Dayjs) => {
    if (p.applyScope !== "following" || !p.clickedOccKey) return nextStart;

    const min = toDayjs(p.clickedOccKey);
    if (nextStart.isBefore(min, "day")) {
      setFormError("‘이 일정과 이후’에서는 선택한 날짜보다 이전으로 시작할 수 없습니다.");
      return min.hour(nextStart.hour()).minute(nextStart.minute()).second(0);
    }
    return nextStart;
  };

  const clampFollowingRepeatStartYmd = (p: FormState, ymd: string) => {
    if (p.applyScope !== "following" || !p.clickedOccKey) return ymd;

    const minYmd = toDayjs(p.clickedOccKey).format("YYYY-MM-DD");
    if (dayjs(ymd).isBefore(dayjs(minYmd), "day")) {
      setFormError("‘이 일정과 이후’에서는 반복 시작일을 선택한 날짜보다 이전으로 설정할 수 없습니다.");
      return minYmd;
    }
    return ymd;
  };

  const toggleMultiDate = (ymd: string) => {
    setForm((p) => {
      const set = new Set(p.multiDates ?? []);
      if (set.has(ymd)) set.delete(ymd);
      else set.add(ymd);
      return { ...p, multiDates: Array.from(set).sort() };
    });
  };

  const clearMultiDates = () => {
    setForm((p) => ({ ...p, multiDates: [] }));
  };

  const onDateClick = (info: any) => {
    setFormError("");
    const base = dayjs(`${info.dateStr}T09:00`);
    const start = base;
    const end = base.add(1, "hour");

    setForm({
      id: "",
      title: "",
      start: formatISO(start),
      end: formatISO(end),
      memo: "",
      repeat: "none",
      repeatInterval: 1,
      repeatRangeStart: "",
      repeatRangeEnd: "",
      repeatSnap: { repeat: "none", repeatInterval: 1, repeatRangeStart: "", repeatRangeEnd: "" },
      multiDates: [info.dateStr],
      color: "#1e2a78",
      createdBy: userId, // ✅ currentUserId 대신
      allDay: false,
      prevStartTime: "09:00",
      prevEndTime: "10:00",
      clickedOccKey: "",
      applyScope: "this",
    });

    setPicker("none");
    setMode("create");
  };

  const onEventClick = (info: any) => {
    setFormError("");
    const e = info.event;

    const startD = toDayjs(e.startStr || "");
    const endD = toDayjs(e.endStr || e.startStr || "");

    const masterId = e.extendedProps?.masterId || e.id;
    const occKey = e.extendedProps?.occKey || "";

    const master = events.find((x) => x.id === masterId);

    const snapRepeat = (master?.repeat ?? e.extendedProps?.repeat ?? "none") as any;
    const snapInterval = Math.max(1, master?.repeatInterval ?? 1);
    const snapRS = master?.repeatRangeStart ?? "";
    const snapRE = master?.repeatRangeEnd ?? "";

    setForm({
      id: masterId,
      title: master?.title ?? e.title ?? "",
      start: formatISO(startD),
      end: formatISO(endD),
      memo: master?.memo ?? e.extendedProps?.memo ?? "",
      repeat: snapRepeat,
      repeatInterval: snapInterval,
      repeatRangeStart: snapRS,
      repeatRangeEnd: snapRE,
      repeatSnap: { repeat: snapRepeat, repeatInterval: snapInterval, repeatRangeStart: snapRS, repeatRangeEnd: snapRE },
      multiDates: [],
      color: master?.color ?? e.backgroundColor ?? "#1e2a78",
      createdBy: master?.createdBy ?? e.extendedProps?.createdBy ?? "",
      allDay: !!(master?.allDay ?? e.allDay),
      prevStartTime: startD.format("HH:mm"),
      prevEndTime: endD.format("HH:mm"),
      clickedOccKey: occKey,
      applyScope: "this",
    });

    setPicker("none");
    setMode("detail");
  };

  const canEdit = form.createdBy === userId;

  const isEditingRecurringOccurrence =
    mode === "detail" && !!form.clickedOccKey && (form.repeatSnap.repeat ?? "none") !== "none";
  const lockRepeatControls = isEditingRecurringOccurrence && form.applyScope === "this";

  const saveNew = async () => {
    
    const t = form.title.trim();
    if (!t) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setFormError("로그인이 필요합니다.");
      return;
    }
    if (!calendarId) {
      setFormError("캘린더 정보가 없습니다. (me에서 defaultCalendarId 확인)");
      return;
    }

    const res = await fetch(`${API_BASE}/api/calendar/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        calendarId, // ✅ 하드코딩 제거
        title: t,
        memo: form.memo,
        color: form.color,
        allDay: form.allDay,
        startAt: form.start,
        endAt: form.end,

        repeatType: form.repeat,
        repeatInterval: form.repeatInterval,
        repeatRangeStart: form.repeatRangeStart,
        repeatRangeEnd: form.repeatRangeEnd,

        multiDates: form.multiDates ?? [],

        // monthly anchor: 시작일의 일자
        repeatAnchorDom: form.repeat === "monthly" ? Number(form.start.slice(8, 10)) : null,
      }),
    });

    
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      if (res.status === 403) setFormError("저장 권한이 없습니다. (calendar_members role 확인)");
      else setFormError(data?.message ?? "저장 중 오류가 발생했습니다.");
      return;
    }

    closeModal();
    await loadEvents();
  };

  // 아래 updateEvent/deleteEvent는 지금처럼 프론트 상태로만 바꾸고 있어서
  // 백엔드 PUT/DELETE 붙이기 전이라면 그대로 두셔도 됩니다.
  // (원하시면 PUT/DELETE까지 “완성본”으로 맞춰드릴게요.)
  const updateEvent = async () => {
    const t = form.title.trim();
    if (!t) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setFormError("로그인이 필요합니다.");
      return;
    }

    // form.id = masterId (events.id)
    if (!form.id) {
      setFormError("수정할 이벤트 id가 없습니다.");
      return;
    }

    // 반복 일정일 때만 scope/occKey 의미가 있음
    const isRecurringMaster = (form.repeatSnap?.repeat ?? "none") !== "none";
    const scope =
      isRecurringMaster && form.clickedOccKey
        ? (form.applyScope ?? "this")
        : "all";

    const occKey = scope === "all" ? "" : (form.clickedOccKey ?? "");

    try {
      const res = await fetch(`${API_BASE}/api/calendar/events/${Number(form.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope,     // "all" | "this" | "following"
          occKey,    // scope가 this/following일 때 필요

          title: t,
          memo: form.memo,
          color: form.color,
          allDay: form.allDay,
          startAt: form.start,
          endAt: form.end,

          // 반복 저장(backend updateEvent가 받는 필드들)
          repeatType: form.repeat,
          repeatInterval: form.repeatInterval,
          repeatRangeStart: form.repeatRangeStart,
          repeatRangeEnd: form.repeatRangeEnd,
          repeatAnchorDom: form.repeat === "monthly" ? Number(form.start.slice(8, 10)) : null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        if (res.status === 403) setFormError("수정 권한이 없습니다. (calendar_members role 확인)");
        else setFormError(data?.message ?? "수정 중 오류가 발생했습니다.");
        return;
      }

      closeModal();
      await loadEvents();
    } catch (e) {
      setFormError("수정 요청 중 네트워크 오류가 발생했습니다.");
    }
  };

  const deleteEvent = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setFormError("로그인이 필요합니다.");
      return;
    }
    if (!form.id) {
      setFormError("삭제할 이벤트 id가 없습니다.");
      return;
    }

    const isRecurringMaster = (form.repeatSnap?.repeat ?? "none") !== "none";
    const scope =
      isRecurringMaster && form.clickedOccKey
        ? (form.applyScope ?? "this")
        : "all";

    const occKey = scope === "all" ? "" : (form.clickedOccKey ?? "");

    try {
      const res = await fetch(`${API_BASE}/api/calendar/events/${Number(form.id)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope,   // "all" | "this" | "following"
          occKey,  // scope가 this/following일 때 필요
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        if (res.status === 403) setFormError("삭제 권한이 없습니다. (calendar_members role 확인)");
        else setFormError(data?.message ?? "삭제 중 오류가 발생했습니다.");
        return;
      }

      closeModal();
      await loadEvents();
    } catch (e) {
      setFormError("삭제 요청 중 네트워크 오류가 발생했습니다.");
    }
  };

  const onToggleAllDay = (checked: boolean) => {
    setForm((p) => {
      const s = toDayjs(p.start);
      const e = toDayjs(p.end);

      if (checked) {
        const backupStart = s.format("HH:mm");
        const backupEnd = e.format("HH:mm");

        const nextStart = s.hour(0).minute(0);
        const nextEnd = e.hour(23).minute(59);
        const fixed = ensureOrderAfterStartChange(nextStart, nextEnd);

        return {
          ...p,
          allDay: true,
          prevStartTime: backupStart,
          prevEndTime: backupEnd,
          start: formatISO(fixed.start),
          end: formatISO(fixed.end),
        };
      } else {
        const sDate = s.format("YYYY-MM-DD");
        const eDate = e.format("YYYY-MM-DD");

        const [sh, sm] = (p.prevStartTime || "09:00").split(":").map(Number);
        const [eh, em] = (p.prevEndTime || "10:00").split(":").map(Number);

        const nextStart = dayjs(`${sDate}T${pad2(sh)}:${pad2(sm)}`);
        const nextEnd = dayjs(`${eDate}T${pad2(eh)}:${pad2(em)}`);
        const fixed = ensureOrderAfterStartChange(nextStart, nextEnd);

        return { ...p, allDay: false, start: formatISO(fixed.start), end: formatISO(fixed.end) };
      }
    });
  };

  const onPickStartDate = (d: Dayjs) => {
    setFormError("");
    setForm((p) => {
      const curStart = toDayjs(p.start);
      const curEnd = toDayjs(p.end);

      let nextStart = d.hour(curStart.hour()).minute(curStart.minute()).second(0);
      nextStart = clampFollowingStart(p, nextStart);

      const normalizedStart = p.allDay ? nextStart.hour(0).minute(0) : nextStart;
      const normalizedEnd = p.allDay ? curEnd.hour(23).minute(59) : curEnd;

      const fixed = ensureOrderAfterStartChange(normalizedStart, normalizedEnd);
      return { ...p, start: formatISO(fixed.start), end: formatISO(fixed.end) };
    });
  };

  const onPickEndDate = (d: Dayjs) => {
    setFormError("");
    setForm((p) => {
      const curStart = toDayjs(p.start);
      const curEnd = toDayjs(p.end);

      const nextEnd = d.hour(curEnd.hour()).minute(curEnd.minute()).second(0);
      const normalizedEnd = p.allDay ? nextEnd.hour(23).minute(59) : nextEnd;
      const normalizedStart = p.allDay ? curStart.hour(0).minute(0) : curStart;

      const fixed = ensureOrderAfterEndChange(normalizedStart, normalizedEnd);
      return { ...p, start: formatISO(fixed.start), end: formatISO(fixed.end) };
    });
  };

  const onPickStartTime = (t: Dayjs) => {
    setFormError("");
    setForm((p) => {
      const curStart = toDayjs(p.start);
      const curEnd = toDayjs(p.end);

      const nextStart = curStart.hour(t.hour()).minute(t.minute()).second(0);
      const fixed = ensureOrderAfterStartChange(nextStart, curEnd);

      return {
        ...p,
        start: formatISO(p.allDay ? nextStart.hour(0).minute(0) : fixed.start),
        end: formatISO(p.allDay ? toDayjs(p.end).hour(23).minute(59) : fixed.end),
        prevStartTime: nextStart.format("HH:mm"),
      };
    });
  };

  const onPickEndTime = (t: Dayjs) => {
    setFormError("");
    setForm((p) => {
      const curStart = toDayjs(p.start);
      const curEnd = toDayjs(p.end);

      const nextEnd = curEnd.hour(t.hour()).minute(t.minute()).second(0);
      const fixed = ensureOrderAfterEndChange(curStart, nextEnd);

      return {
        ...p,
        start: formatISO(p.allDay ? toDayjs(p.start).hour(0).minute(0) : fixed.start),
        end: formatISO(p.allDay ? nextEnd.hour(23).minute(59) : fixed.end),
        prevEndTime: nextEnd.format("HH:mm"),
      };
    });
  };

  const onPickRepeatStartDate = (d: Dayjs) => {
    setFormError("");
    const ymdRaw = d.format("YYYY-MM-DD");

    setForm((p) => {
      const ymd = clampFollowingRepeatStartYmd(p, ymdRaw);

      const nextEnd =
        p.repeatRangeEnd && dayjs(p.repeatRangeEnd).isBefore(dayjs(ymd), "day") ? ymd : p.repeatRangeEnd;

      return { ...p, repeatRangeStart: ymd, repeatRangeEnd: nextEnd };
    });
  };

  const onPickRepeatEndDate = (d: Dayjs) => {
    setFormError("");
    const ymd = d.format("YYYY-MM-DD");

    setForm((p) => {
      const nextStart =
        p.repeatRangeStart && dayjs(p.repeatRangeStart).isAfter(dayjs(ymd), "day") ? ymd : p.repeatRangeStart;

      return { ...p, repeatRangeEnd: ymd, repeatRangeStart: nextStart };
    });
  };

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        .fc .fc-daygrid-event { border-radius: 8px; padding: 2px 6px; }
        .fc .fc-daygrid-dot-event {
          border-radius: 8px;
          padding: 2px 6px;
          background: var(--fc-event-bg-color, rgba(30,42,120,0.2));
          border: 1px solid var(--fc-event-border-color, rgba(30,42,120,0.35));
        }
        .fc .fc-daygrid-dot-event .fc-daygrid-event-dot { display: none; }
        .fc .fc-daygrid-dot-event .fc-event-title,
        .fc .fc-daygrid-dot-event .fc-event-time { color: var(--fc-event-text-color, #fff); font-weight: 700; }

        .fc .pz-day-red  .fc-daygrid-day-number { color: #dc2626 !important; }
        .fc .pz-day-blue .fc-daygrid-day-number { color: #2563eb !important; }
        .fc .pz-day-black .fc-daygrid-day-number { color: rgba(0,0,0,0.9) !important; }

        .fc .pz-dow-red  .fc-col-header-cell-cushion { color: #dc2626 !important; }
        .fc .pz-dow-blue .fc-col-header-cell-cushion { color: #2563eb !important; }
        .fc .pz-dow-black .fc-col-header-cell-cushion { color: rgba(0,0,0,0.9) !important;}

        .fc .pz-holiday-tip { position: relative; }
        .fc .pz-holiday-tip:hover::after {
          content: attr(data-holiday);
          position: absolute;
          left: 50%;
          top: 4px;
          transform: translateX(-50%);
          z-index: 999999;
          padding: 6px 8px;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.85);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          pointer-events: none;
        }
        .fc .pz-holiday-tip:hover::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 0px;
          transform: translateX(-50%);
          z-index: 999999;
          border: 6px solid transparent;
          border-bottom-color: rgba(0,0,0,0.85);
          pointer-events: none;
        }
      `}</style>

      <CalendarView
        calRef={calRef}
        expandedEvents={expandedEvents}
        holidayMap={holidayMap}
        getDayType={getDayType}
        onDateClick={onDateClick}
        onEventClick={onEventClick}
        onDatesSet={(range, year) => {
          setHolidayYear(year);
          setViewRange(range);
        }}
      />

      {mode !== "none" && (
        <EventModal
          mode={mode}
          form={form}
          setForm={setForm}
          formError={formError}
          setFormError={setFormError}
          holidaySet={holidaySet}
          picker={picker}
          setPicker={setPicker}
          lockRepeatControls={lockRepeatControls}
          canEdit={canEdit}
          onToggleAllDay={onToggleAllDay}
          onPickStartDate={onPickStartDate}
          onPickEndDate={onPickEndDate}
          onPickStartTime={onPickStartTime}
          onPickEndTime={onPickEndTime}
          onPickRepeatStartDate={onPickRepeatStartDate}
          onPickRepeatEndDate={onPickRepeatEndDate}
          toggleMultiDate={toggleMultiDate}
          clearMultiDates={clearMultiDates}
          closeModal={closeModal}
          saveNew={saveNew}
          updateEvent={updateEvent}
          deleteEvent={deleteEvent}
          getDayType={getDayType}
        />
      )}
    </div>
  );
};

export default Calendar;
