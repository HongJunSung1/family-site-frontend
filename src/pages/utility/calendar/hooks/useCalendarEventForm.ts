import React, { useState } from "react";
import type { EventClickArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import dayjs, { Dayjs } from "dayjs";

import { ApiError, hasAccessToken } from "../../../../api/client";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  type CalendarEventPayload,
  type UpdateCalendarEventPayload,
} from "../../../../api/calendarApi";
import type { CalEvent, FormState, ModalMode, PickerTarget, RepeatType } from "../types";
import type { ExpandedEvent } from "../utils/recurrence";
import { addHours, formatISO, pad2, toDayjs } from "../utils/date";

type UseCalendarEventFormParams = {
  userId: string;
  events: CalEvent[];
  calendarId: number | null;
  loadEvents: () => Promise<void>;
  setFormError: (message: string) => void;
};

const createEmptyForm = (): FormState => ({
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
  locationLat: null,
  locationLng: null,
  locationName: "",
  locationAddress: "",
});

// 일정 모달의 폼 상태와 저장/수정/삭제 액션을 관리한다.
export function useCalendarEventForm({
  userId,
  events,
  calendarId,
  loadEvents,
  setFormError,
}: UseCalendarEventFormParams) {
  const [mode, setMode] = useState<ModalMode>("none");
  const [picker, setPicker] = useState<PickerTarget>("none");
  const [form, setForm] = useState<FormState>(() => createEmptyForm());

  // 반복이면 multiDates 금지 (기존 정책 유지)
  const isRecurringForMultiDates =
    (form.repeatSnap?.repeat ?? "none") !== "none" || (form.repeat ?? "none") !== "none";

  const closeModal = React.useCallback(() => {
    setFormError("");
    setPicker("none");
    setMode("none");
  }, [setFormError]);

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

  const openCreateAtDate = (dateStr: string) => {
    setFormError("");
    const base = dayjs(`${dateStr}T09:00`);
    const start = base;
    const end = base.add(1, "hour");

    setForm({
      ...createEmptyForm(),
      start: formatISO(start),
      end: formatISO(end),
      createdBy: userId,
    });

    setPicker("none");
    setMode("create");
  };

  const onDateClick = (info: DateClickArg) => {
    openCreateAtDate(info.dateStr);
  };

  const openEventDetail = (event: ExpandedEvent) => {
    setFormError("");

    const startD = toDayjs(event.start || "");
    const endD = toDayjs(event.end || event.start || "");

    const masterId = String(event.__masterId ?? event.id ?? "");
    const occKey = String(event.__occKey ?? "");

    const master = events.find((x) => x.id === masterId);

    const snapRepeat = (master?.repeat ?? event.repeat ?? "none") as RepeatType;
    const snapInterval = Math.max(1, master?.repeatInterval ?? event.repeatInterval ?? 1);
    const snapRS = master?.repeatRangeStart ?? event.repeatRangeStart ?? "";
    const snapRE = master?.repeatRangeEnd ?? event.repeatRangeEnd ?? "";

    const occTitle = String(event.title ?? master?.title ?? "");
    const occMemo = String(event.memo ?? master?.memo ?? "");
    const occColor = String(event.color ?? master?.color ?? "#1e2a78");
    const occCreatedBy = String(event.createdBy ?? master?.createdBy ?? "");
    const occAllDay = !!(event.allDay ?? master?.allDay);

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
      locationLat:
        event.locationLat != null ? Number(event.locationLat) : master?.locationLat ?? null,
      locationLng:
        event.locationLng != null ? Number(event.locationLng) : master?.locationLng ?? null,

      locationName: String(event.locationName ?? master?.locationName ?? ""),
      locationAddress: String(event.locationAddress ?? master?.locationAddress ?? ""),
    });

    setPicker("none");
    setMode("detail");
  };

  const onEventClick = (info: EventClickArg) => {
    const e = info.event;

    openEventDetail({
      id: String(e.extendedProps?.masterId || e.id || ""),
      title: String(e.title ?? ""),
      start: e.startStr || "",
      end: e.endStr || e.startStr || "",
      memo: String(e.extendedProps?.memo ?? ""),
      color: String(e.backgroundColor || "#1e2a78"),
      createdBy: String(e.extendedProps?.createdBy ?? ""),
      createdByName: String(e.extendedProps?.createdByName ?? ""),
      allDay: !!e.allDay,
      repeat: (e.extendedProps?.repeat ?? "none") as RepeatType,
      repeatInterval: Number(e.extendedProps?.repeatInterval ?? 1),
      repeatRangeStart: String(e.extendedProps?.repeatRangeStart ?? ""),
      repeatRangeEnd: String(e.extendedProps?.repeatRangeEnd ?? ""),
      locationName: String(e.extendedProps?.locationName ?? ""),
      locationAddress: String(e.extendedProps?.locationAddress ?? ""),
      locationLat:
        e.extendedProps?.locationLat != null ? Number(e.extendedProps.locationLat) : null,
      locationLng:
        e.extendedProps?.locationLng != null ? Number(e.extendedProps.locationLng) : null,
      __masterId: String(e.extendedProps?.masterId || e.id || ""),
      __occKey: String(e.extendedProps?.occKey || ""),
    });
  };

  const canEdit = form.createdBy === userId;

  const isEditingRecurringOccurrence =
    mode === "detail" && !!form.clickedOccKey && (form.repeatSnap.repeat ?? "none") !== "none";
  const lockRepeatControls = isEditingRecurringOccurrence && form.applyScope === "this";

  const buildEventPayload = (
    title: string,
    options: { calendarId?: number; multiDates?: string[]; forceSingle?: boolean } = {}
  ): CalendarEventPayload => ({
    calendarId: options.calendarId,
    title,
    memo: form.memo,
    color: form.color,
    allDay: form.allDay,
    startAt: form.start,
    endAt: form.end,
    locationName: form.locationName,
    locationAddress: form.locationAddress,
    locationLat: form.locationLat,
    locationLng: form.locationLng,
    repeatType: options.forceSingle ? "none" : form.repeat,
    repeatInterval: options.forceSingle ? 1 : form.repeatInterval,
    repeatRangeStart: options.forceSingle ? "" : form.repeatRangeStart,
    repeatRangeEnd: options.forceSingle ? "" : form.repeatRangeEnd,
    multiDates: options.multiDates,
    repeatAnchorDom: options.forceSingle || form.repeat !== "monthly" ? null : Number(form.start.slice(8, 10)),
  });

  const saveNew = async () => {
    const t = form.title.trim();
    if (!t) return;

    if (!hasAccessToken()) {
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

    try {
      await createCalendarEvent(buildEventPayload(t, { calendarId, multiDates: multiDatesToSend }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setFormError("저장 권한이 없습니다. (calendar_members role 확인)");
      else setFormError(error instanceof ApiError ? error.data?.message ?? "저장 중 오류가 발생했습니다." : "저장 중 오류가 발생했습니다.");
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

    if (!hasAccessToken()) {
      setFormError("로그인이 필요합니다.");
      return;
    }
    if (!calendarId) {
      setFormError("캘린더 정보가 없습니다. (me에서 defaultCalendarId 확인)");
      return;
    }

    try {
      await createCalendarEvent(buildEventPayload(t, { calendarId, multiDates: md, forceSingle: true }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setFormError("저장 권한이 없습니다. (calendar_members role 확인)");
      else setFormError(error instanceof ApiError ? error.data?.message ?? "복제 생성 중 오류가 발생했습니다." : "복제 생성 중 오류가 발생했습니다.");
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

    if (!hasAccessToken()) {
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
      const payload: UpdateCalendarEventPayload = {
        ...buildEventPayload(t),
        scope,
        occKey,
      };
      await updateCalendarEvent(Number(form.id), payload);

      closeModal();
      await loadEvents();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setFormError("수정 권한이 없습니다. (calendar_members role 확인)");
      else setFormError(error instanceof ApiError ? error.data?.message ?? "수정 중 오류가 발생했습니다." : "수정 요청 중 네트워크 오류가 발생했습니다.");
    }
  };

  const deleteEvent = async () => {
    if (!hasAccessToken()) {
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
      await deleteCalendarEvent(Number(form.id), { scope, occKey });

      closeModal();
      await loadEvents();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setFormError("삭제 권한이 없습니다. (calendar_members role 확인)");
      else setFormError(error instanceof ApiError ? error.data?.message ?? "삭제 중 오류가 발생했습니다." : "삭제 요청 중 네트워크 오류가 발생했습니다.");
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

  return {
    form,
    setForm,
    mode,
    picker,
    setPicker,
    canEdit,
    lockRepeatControls,
    onDateClick,
    openCreateAtDate,
    onEventClick,
    openEventDetail,
    onToggleAllDay,
    onPickStartDate,
    onPickEndDate,
    onPickStartTime,
    onPickEndTime,
    onPickRepeatStartDate,
    onPickRepeatEndDate,
    toggleMultiDate,
    clearMultiDates,
    closeModal,
    saveNew,
    updateEvent,
    deleteEvent,
  };
}
