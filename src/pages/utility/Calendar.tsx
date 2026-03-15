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

import styles from "./Calendar.module.css";

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

  // 로그인/캘린더 정보
  const [userId, setUserId] = useState<string>("");
  const [calendarId, setCalendarId] = useState<number | null>(null);

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

  // 반복이면 multiDates 금지 (기존 정책 유지)
  const isRecurringForMultiDates =
    (form.repeatSnap?.repeat ?? "none") !== "none" || (form.repeat ?? "none") !== "none";

  // /api/auth/me 로 userId + defaultCalendarId 가져오기
  useEffect(() => {
    // console.log("✅ [ME] effect mounted");
    (async () => {
      const token = localStorage.getItem("accessToken");
      // console.log("✅ [ME] token exists?", !!token);
      if (!token) {
        setFormError("로그인이 필요합니다.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // console.log("✅ [ME] status:", res.status);
      const data = (await res.json().catch(() => null)) as MeResponse | null;
      // console.log("📦 [ME] raw:", data);
      if (!res.ok || !data?.ok) {
        setFormError(data?.message ?? "로그인 정보를 불러오지 못했습니다.");
        return;
      }

      const uid = String(data.user?.id ?? "");
      setUserId(uid);

      const cid = data.defaultCalendarId ?? null;
      setCalendarId(cid);
      // console.log("📅 [ME] parsed calendarId:", cid, "typeof:", typeof cid);

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

  // 반복이면 multiDates 조작 금지(기존 정책 유지)
  const toggleMultiDate = (ymd: string) => {
    if (isRecurringForMultiDates) {
      setFormError("반복일정에서는 '여러 날짜에 동일 일정 추가'를 사용할 수 없습니다.");
      return;
    }
    setForm((p) => {
      const set = new Set(p.multiDates ?? []);
      if (set.has(ymd)) set.delete(ymd);
      else set.add(ymd);
      return { ...p, multiDates: Array.from(set).sort() };
    });
  };

  const clearMultiDates = () => {
    if (isRecurringForMultiDates) {
      setFormError("반복일정에서는 '여러 날짜에 동일 일정 추가'를 사용할 수 없습니다.");
      return;
    }
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

      // 날짜 클릭 시 multiDates는 비워둔다
      multiDates: [],

      color: "#1e2a78",
      createdBy: userId,
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

    const masterId = String(e.extendedProps?.masterId || e.id || "");
    const occKey = String(e.extendedProps?.occKey || "");

    const master = events.find((x) => x.id === masterId);

    const snapRepeat = (master?.repeat ?? e.extendedProps?.repeat ?? "none") as any;
    const snapInterval = Math.max(1, master?.repeatInterval ?? e.extendedProps?.repeatInterval ?? 1);
    const snapRS = master?.repeatRangeStart ?? e.extendedProps?.repeatRangeStart ?? "";
    const snapRE = master?.repeatRangeEnd ?? e.extendedProps?.repeatRangeEnd ?? "";

    const occTitle = String(e.title ?? master?.title ?? "");
    const occMemo = String(e.extendedProps?.memo ?? master?.memo ?? "");
    const occColor = String(e.backgroundColor ?? master?.color ?? "#1e2a78");
    const occCreatedBy = String(e.extendedProps?.createdBy ?? master?.createdBy ?? "");
    const occAllDay = !!(e.allDay ?? master?.allDay);

    const isRecurringClick = occKey && (snapRepeat ?? "none") !== "none";
    const initialScope = isRecurringClick ? "this" : "all";

    setForm({
      id: masterId,
      title: occTitle,
      start: formatISO(startD),
      end: formatISO(endD),
      memo: occMemo,

      repeat: snapRepeat,
      repeatInterval: snapInterval,
      repeatRangeStart: snapRS,
      repeatRangeEnd: snapRE,
      repeatSnap: {
        repeat: snapRepeat,
        repeatInterval: snapInterval,
        repeatRangeStart: snapRS,
        repeatRangeEnd: snapRE,
      },

      // detail에서도 multiDates 사용 가능(단, 반복은 toggle/clear에서 막음)
      multiDates: [],

      color: occColor,
      createdBy: occCreatedBy,
      allDay: occAllDay,

      prevStartTime: startD.format("HH:mm"),
      prevEndTime: endD.format("HH:mm"),

      clickedOccKey: isRecurringClick ? occKey : "",
      applyScope: initialScope,
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

    // 안전장치: multiDates는 "2개 이상"일 때만 서버로 보냄 (단건 저장과 충돌 방지)
    const mdRaw = (form.multiDates ?? []).filter(Boolean);
    const multiDatesToSend = mdRaw.length >= 2 ? mdRaw : [];

    const res = await fetch(`${API_BASE}/api/calendar/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        calendarId,
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

        multiDates: multiDatesToSend,

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

  /**
   * detail에서 multiDates 선택 시 => "수정"이 아니라 "복제 생성"으로 처리
   * - 반복 일정에서는 기존 정책대로 금지
   */
  const createClonesFromDetail = async () => {
    const t = form.title.trim();
    if (!t) return;

    if (isRecurringForMultiDates) {
      setFormError("반복일정에서는 '여러 날짜에 동일 일정 추가'를 사용할 수 없습니다.");
      return;
    }

    const md = (form.multiDates ?? []).filter(Boolean);
    if (md.length === 0) {
      setFormError("복제할 날짜를 선택해주세요.");
      return;
    }

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
        calendarId,
        title: t,
        memo: form.memo,
        color: form.color,
        allDay: form.allDay,
        startAt: form.start,
        endAt: form.end,

        repeatType: "none",
        repeatInterval: 1,
        repeatRangeStart: "",
        repeatRangeEnd: "",

        multiDates: md,

        repeatAnchorDom: null,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      if (res.status === 403) setFormError("저장 권한이 없습니다. (calendar_members role 확인)");
      else setFormError(data?.message ?? "복제 생성 중 오류가 발생했습니다.");
      return;
    }

    closeModal();
    await loadEvents();
  };

  const updateEvent = async () => {
    const t = form.title.trim();
    if (!t) return;

    // detail에서 multiDates가 선택되어 있으면 => "수정" 대신 "복제 생성"
    if (mode === "detail" && (form.multiDates?.length ?? 0) > 0) {
      await createClonesFromDetail();
      return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setFormError("로그인이 필요합니다.");
      return;
    }

    if (!form.id) {
      setFormError("수정할 이벤트 id가 없습니다.");
      return;
    }

    const isRecurringMaster = (form.repeatSnap?.repeat ?? "none") !== "none";
    const scope = isRecurringMaster && form.clickedOccKey ? (form.applyScope ?? "this") : "all";
    const occKey = scope === "all" ? "" : (form.clickedOccKey ?? "");

    try {
      const res = await fetch(`${API_BASE}/api/calendar/events/${Number(form.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope,
          occKey,

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
    const scope = isRecurringMaster && form.clickedOccKey ? (form.applyScope ?? "this") : "all";
    const occKey = scope === "all" ? "" : (form.clickedOccKey ?? "");

    try {
      const res = await fetch(`${API_BASE}/api/calendar/events/${Number(form.id)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope,
          occKey,
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
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.card}>
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
      </div>
    </div>
  );
};

export default Calendar;
