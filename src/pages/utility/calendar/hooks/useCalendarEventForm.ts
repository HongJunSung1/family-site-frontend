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

// 일정 폼 기본값 생성
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

// 일정 모달 폼 상태와 저장/수정/삭제 액션 관리
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

  // 반복 일정의 여러 날짜 선택 제한 여부
  const isRecurringForMultiDates =
    (form.repeatSnap?.repeat ?? "none") !== "none" || (form.repeat ?? "none") !== "none";

  // 일정 모달 닫기와 선택기 상태 초기화
  const closeModal = React.useCallback(() => {
    setFormError("");
    setPicker("none");
    setMode("none");
  }, [setFormError]);

  // 뒤로가기 취소 시 이전 모달 상태 복원
  const restoreModal = React.useCallback(
    (snapshot: { mode: Exclude<ModalMode, "none">; form: FormState }) => {
      setFormError("");
      setPicker("none");
      setForm(snapshot.form);
      setMode(snapshot.mode);
    },
    [setFormError]
  );

  // 시작 시간이 종료 시간보다 늦을 때 종료 시간 자동 보정
  const ensureOrderAfterStartChange = (nextStart: Dayjs, currentEnd: Dayjs) => {
    if (nextStart.isAfter(currentEnd)) return { start: nextStart, end: addHours(nextStart, 1) };
    return { start: nextStart, end: currentEnd };
  };

  // 종료 시간이 시작 시간보다 빠를 때 시작 시간 자동 보정
  const ensureOrderAfterEndChange = (currentStart: Dayjs, nextEnd: Dayjs) => {
    if (nextEnd.isBefore(currentStart)) return { start: addHours(nextEnd, -1), end: nextEnd };
    return { start: currentStart, end: nextEnd };
  };

  // 반복 일정 이후 수정 범위에서 시작일 하한 보정
  const clampFollowingStart = (p: FormState, nextStart: Dayjs) => {
    if (p.applyScope !== "following" || !p.clickedOccKey) return nextStart;

    const min = toDayjs(p.clickedOccKey);
    if (nextStart.isBefore(min, "day")) {
      setFormError("‘이 일정과 이후’에서는 선택한 날짜보다 이전으로 시작할 수 없습니다.");
      return min.hour(nextStart.hour()).minute(nextStart.minute()).second(0);
    }
    return nextStart;
  };

  // 반복 시작일이 선택한 발생일보다 앞서지 않도록 보정
  const clampFollowingRepeatStartYmd = (p: FormState, ymd: string) => {
    if (p.applyScope !== "following" || !p.clickedOccKey) return ymd;

    const minYmd = toDayjs(p.clickedOccKey).format("YYYY-MM-DD");
    if (dayjs(ymd).isBefore(dayjs(minYmd), "day")) {
      setFormError("‘이 일정과 이후’에서는 반복 시작일을 선택한 날짜보다 이전으로 설정할 수 없습니다.");
      return minYmd;
    }
    return ymd;
  };

  // 여러 날짜 선택 토글과 반복 일정 제한
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

  // 선택한 여러 날짜 초기화
  const clearMultiDates = () => {
    if (isRecurringForMultiDates) {
      setFormError("반복일정에서는 '여러 날짜에 동일 일정 추가'를 사용할 수 없습니다.");
      return;
    }
    setForm((p) => ({ ...p, multiDates: [] }));
  };

  // 특정 날짜 기준 새 일정 모달 열기
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

  // 캘린더 날짜 클릭 시 새 일정 생성 시작
  const onDateClick = (info: DateClickArg) => {
    openCreateAtDate(info.dateStr);
  };

  // 일정 목록/막대 클릭 시 상세 모달 열기
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

      // 상세 화면 여러 날짜 복제용 선택값 초기화
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

  // FullCalendar 이벤트 클릭 데이터를 상세 모달 데이터로 변환
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

  // 저장/수정 API에 전달할 일정 payload 생성
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

  // 새 일정 저장
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

    // 단건 저장과 충돌하지 않도록 여러 날짜는 2개 이상일 때만 전송
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

  // 상세 화면에서 여러 날짜 선택 시 수정 대신 복제 생성
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

  // 기존 일정 수정 또는 여러 날짜 복제 생성
  const updateEvent = async () => {
    const t = form.title.trim();
    if (!t) return;

    // 상세 화면 여러 날짜 선택 시 수정 대신 복제 생성
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

  // 일정 삭제
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

  // 하루 종일 토글과 기존 시간 백업/복원
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

  // 시작 날짜 선택 처리
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

  // 종료 날짜 선택 처리
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

  // 시작 시간 선택 처리
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

  // 종료 시간 선택 처리
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

  // 반복 시작일 선택 처리
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

  // 반복 종료일 선택 처리
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
    restoreModal,
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
