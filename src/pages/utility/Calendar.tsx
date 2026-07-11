import React, { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { DateClickArg } from "@fullcalendar/interaction";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";

import { useCalendarData } from "./calendar/hooks/useCalendarData";
import { useCalendarEventForm } from "./calendar/hooks/useCalendarEventForm";
import { useHolidays } from "./calendar/hooks/useHolidays";
import { ConfirmDialog } from "../../common/dialog";
import { LoadingOverlay } from "../../common/loading";
import { useMobileHeader } from "../../common/mobile-header";
import { CalendarView } from "./calendar/components/CalendarView";
import { EventModal } from "./calendar/components/EventModal";
import { expandRecurringEvents } from "./calendar/utils/recurrence";
import type { ExpandedEvent } from "./calendar/utils/recurrence";
import type { FormState, ModalMode } from "./calendar/types";

import styles from "./Calendar.module.css";

dayjs.locale("ko");

const EVENT_TOOLTIP_ID = "pz-floating-event-tooltip";

// 떠 있는 일정 hover 툴팁 제거
const removeFloatingTooltip = () => {
  document.getElementById(EVENT_TOOLTIP_ID)?.remove();
};

// 일정 목록 hover 툴팁 위치 계산과 표시
const showFloatingTooltip = (eventEl: HTMLElement, tooltipText: string) => {
  removeFloatingTooltip();

  if (!tooltipText) return;

  const tooltip = document.createElement("div");
  tooltip.id = EVENT_TOOLTIP_ID;
  tooltip.className = "pz-floating-event-tooltip";
  tooltip.textContent = tooltipText;
  document.body.appendChild(tooltip);

  const eventRect = eventEl.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(
    Math.max(margin, eventRect.left + eventRect.width / 2 - tooltipRect.width / 2),
    window.innerWidth - tooltipRect.width - margin
  );
  const belowTop = eventRect.bottom + margin;
  const top =
    belowTop + tooltipRect.height <= window.innerHeight - margin
      ? belowTop
      : Math.max(margin, eventRect.top - tooltipRect.height - margin);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
};

// 공휴일 표시명 보정
const getHolidayDisplayName = (name?: string) => {
  if (!name) return "";
  return name === "기독탄신일" ? "크리스마스" : name;
};

type ModalSnapshot = {
  mode: Exclude<ModalMode, "none">;
  form: FormState;
};

type BackConfirmState = {
  action: "restore" | "close";
};

type DiscardConfirmState = {
  onConfirm: () => void;
};

// 브라우저 history guard 사용 가능 여부 확인
const canUseCalendarHistoryGuard = () => typeof window !== "undefined";
const HOME_BACK_GUARD_DEPTH = 1;
const MODAL_BACK_GUARD_DEPTH = 2;
const BACK_DEBUG_STORAGE_KEY = "calendarBackDebugLines";
const BACK_GUARD_PARAM = "_calendarBackGuard";
const BACK_GUARD_HASH_PREFIX = "#calendar-back-guard-";

// 뒤로가기 디버그 모드 활성 여부 확인
const isBackDebugEnabled = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const debugParam = params.get("debugBack");

  if (debugParam === "1") {
    return true;
  }

  if (debugParam === "0") {
    window.localStorage.removeItem(BACK_DEBUG_STORAGE_KEY);
    return false;
  }

  return false;
};

// 모달 폼 스냅샷 복제
const cloneForm = (form: FormState): FormState => JSON.parse(JSON.stringify(form)) as FormState;

// 저장된 뒤로가기 디버그 로그 조회
const readBackDebugLines = () => {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(BACK_DEBUG_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String).slice(-80) : [];
  } catch {
    return [];
  }
};

// history guard 파라미터를 제외한 캘린더 기준 URL 생성
const getCleanCalendarUrl = () => {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  url.searchParams.delete(BACK_GUARD_PARAM);
  const cleanHash = url.hash.startsWith(BACK_GUARD_HASH_PREFIX) ? "" : url.hash;
  return `${url.pathname}${url.search}${cleanHash}`;
};

// 캘린더 화면과 선택 날짜 일정 패널 관리
const Calendar: React.FC = () => {
  const calRef = useRef<FullCalendar | null>(null);
  const { setConfig: setMobileHeaderConfig, resetConfig: resetMobileHeaderConfig } = useMobileHeader();

  const [formError, setFormError] = useState<string>("");
  const [holidayYear, setHolidayYear] = useState<number>(dayjs().year());
  const [selectedDate, setSelectedDate] = useState<string>(() => dayjs().format("YYYY-MM-DD"));
  const [modalOpenVersion, setModalOpenVersion] = useState(0);
  const [backConfirm, setBackConfirm] = useState<BackConfirmState | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState<DiscardConfirmState | null>(null);
  const [backDebugEnabled] = useState(isBackDebugEnabled);
  const [backDebugLines, setBackDebugLines] = useState<string[]>(() =>
    backDebugEnabled ? readBackDebugLines() : []
  );
  const openedFormSnapshotRef = useRef<string>("");
  const modalBackStackRef = useRef<ModalSnapshot[]>([]);
  const backConfirmRef = useRef<BackConfirmState | null>(null);
  const calendarBaseUrlRef = useRef("");
  const allowBackStepsRef = useRef(0);
  const historyGuardArmedRef = useRef(false);
  const backGuardDepthRef = useRef(0);
  const backGuardSeqRef = useRef(0);
  const backEventLockRef = useRef(false);
  const modeRef = useRef<ModalMode>("none");
  const [viewRange, setViewRange] = useState<{ start: Dayjs; end: Dayjs }>(() => {
    const now = dayjs();
    return { start: now.startOf("month"), end: now.endOf("month").add(1, "day") };
  });

  const { holidaySet, holidayMap } = useHolidays(holidayYear);

  // 뒤로가기 제어 디버그 로그 기록
  const logBackDebug = React.useCallback(
    (message: string) => {
      if (!backDebugEnabled || typeof window === "undefined") return;

      const line = [
        new Date().toLocaleTimeString(),
        message,
        `mode=${modeRef.current}`,
        `modalConfirm=${backConfirmRef.current?.action ?? "none"}`,
        `guards=${backGuardDepthRef.current}`,
        `search=${window.location.search || "-"}`,
        `hash=${window.location.hash || "-"}`,
      ].join(" | ");

      console.info("[calendar-back]", line);
      setBackDebugLines((prev) => {
        const next = [...prev, line].slice(-80);
        window.localStorage.setItem(BACK_DEBUG_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [backDebugEnabled]
  );

  // 로그인 사용자와 현재 캘린더의 이벤트 목록을 관리한다.
  const {
    events,
    userId,
    calendars,
    calendarId,
    calendarName,
    calendarsLoading,
    eventsLoading,
    loadEvents,
    handleCalendarTabClick,
  } = useCalendarData({ setFormError });

  // 일정 모달의 폼 상태와 생성/수정/삭제 액션을 관리한다.
  const {
    form,
    setForm,
    mode,
    picker,
    setPicker,
    canEdit,
    lockRepeatControls,
    openCreateAtDate,
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
  } = useCalendarEventForm({
    userId,
    events,
    calendarId,
    loadEvents,
    setFormError,
  });

  // 반복 일정을 현재 표시 범위의 실제 발생 일정으로 확장
  const expandedEvents = useMemo(
    () => expandRecurringEvents(events, viewRange.start, viewRange.end),
    [events, viewRange.start, viewRange.end]
  );

  // 특정 일정이 선택 날짜에 포함되는지 확인
  const eventOccursOnDate = React.useCallback((event: ExpandedEvent, ymd: string) => {
    const day = dayjs(ymd);
    const start = dayjs(event.start).startOf("day");
    const end = dayjs(event.end || event.start).startOf("day");
    return !day.isBefore(start, "day") && !day.isAfter(end, "day");
  }, []);

  // 반복 발생 일정을 구분하는 화면 표시용 키 생성
  const getEventVisualKey = React.useCallback((event: ExpandedEvent) => {
    return `${event.id}-${event.__occKey ?? event.start}`;
  }, []);

  // 날짜별 전체 일정 개수 계산
  const eventCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    let cursor = viewRange.start.startOf("day");
    const end = viewRange.end.startOf("day");

    while (cursor.isBefore(end)) {
      const ymd = cursor.format("YYYY-MM-DD");
      const count = expandedEvents.filter((event) => eventOccursOnDate(event, ymd)).length;
      if (count > 0) counts.set(ymd, count);
      cursor = cursor.add(1, "day");
    }

    return counts;
  }, [eventOccursOnDate, expandedEvents, viewRange.start, viewRange.end]);

  // 날짜별 일정 막대 lane 배치 계산
  const eventBarsByDate = useMemo(() => {
    const bars = new Map<
      string,
      Array<{ key: string; color: string; isStart: boolean; isEnd: boolean; lane: number }>
    >();

    let weekStart = viewRange.start.startOf("day");
    const rangeEnd = viewRange.end.startOf("day");

    while (weekStart.isBefore(rangeEnd)) {
      const weekEnd = weekStart.add(7, "day").isAfter(rangeEnd)
        ? rangeEnd
        : weekStart.add(7, "day");

      // 긴 일정 우선 배치를 위한 주 단위 일정 정렬
      const weekEvents = expandedEvents
        .filter((event) => {
          const start = dayjs(event.start).startOf("day");
          const end = dayjs(event.end || event.start).startOf("day");
          return !end.isBefore(weekStart, "day") && start.isBefore(weekEnd, "day");
        })
        .sort((a, b) => {
          const aStart = dayjs(a.start).startOf("day");
          const bStart = dayjs(b.start).startOf("day");
          const aEnd = dayjs(a.end || a.start).startOf("day");
          const bEnd = dayjs(b.end || b.start).startOf("day");
          const aSpan = aEnd.diff(aStart, "day") + 1;
          const bSpan = bEnd.diff(bStart, "day") + 1;

          if (aSpan !== bSpan) return bSpan - aSpan;

          const startDiff = aStart.valueOf() - bStart.valueOf();
          if (startDiff !== 0) return startDiff;

          return String(a.id).localeCompare(String(b.id));
        });

      const occupiedByDate = new Map<string, Set<number>>();

      weekEvents.forEach((event) => {
        const eventStart = dayjs(event.start).startOf("day");
        const eventEnd = dayjs(event.end || event.start).startOf("day");
        const firstDay = eventStart.isAfter(weekStart) ? eventStart : weekStart;
        const lastWeekDay = weekEnd.subtract(1, "day");
        const lastDay = eventEnd.isBefore(lastWeekDay) ? eventEnd : lastWeekDay;
        const key = getEventVisualKey(event);
        const spanDays: string[] = [];

        let spanCursor = firstDay;
        while (!spanCursor.isAfter(lastDay, "day")) {
          spanDays.push(spanCursor.format("YYYY-MM-DD"));
          spanCursor = spanCursor.add(1, "day");
        }

        // 겹치는 날짜 전체에서 비어 있는 lane 탐색
        let lane = 0;
        while (spanDays.some((ymd) => occupiedByDate.get(ymd)?.has(lane))) {
          lane += 1;
        }

        spanDays.forEach((ymd) => {
          const lanes = occupiedByDate.get(ymd) ?? new Set<number>();
          lanes.add(lane);
          occupiedByDate.set(ymd, lanes);
        });

        let cursor = firstDay;
        while (!cursor.isAfter(lastDay, "day")) {
          const ymd = cursor.format("YYYY-MM-DD");
          const dayBars = bars.get(ymd) ?? [];

          dayBars.push({
            key,
            color: event.color || "#1e2a78",
            isStart: cursor.isSame(eventStart, "day"),
            isEnd: cursor.isSame(eventEnd, "day"),
            lane,
          });

          bars.set(ymd, dayBars);
          cursor = cursor.add(1, "day");
        }
      });

      weekStart = weekStart.add(7, "day");
    }

    return bars;
  }, [expandedEvents, getEventVisualKey, viewRange.start, viewRange.end]);

  // 선택 날짜의 일정 목록을 막대 표시 순서와 동일하게 정렬
  const selectedDateEvents = useMemo(
    () => {
      const selectedBars = eventBarsByDate.get(selectedDate) ?? [];
      const laneByKey = new Map(selectedBars.map((bar) => [bar.key, bar.lane]));

      return expandedEvents
        .filter((event) => eventOccursOnDate(event, selectedDate))
        .sort((a, b) => {
          const aLane = laneByKey.get(getEventVisualKey(a)) ?? Number.MAX_SAFE_INTEGER;
          const bLane = laneByKey.get(getEventVisualKey(b)) ?? Number.MAX_SAFE_INTEGER;

          if (aLane !== bLane) return aLane - bLane;

          const aStart = dayjs(a.start).startOf("day");
          const bStart = dayjs(b.start).startOf("day");
          const aEnd = dayjs(a.end || a.start).startOf("day");
          const bEnd = dayjs(b.end || b.start).startOf("day");
          const aSpan = aEnd.diff(aStart, "day") + 1;
          const bSpan = bEnd.diff(bStart, "day") + 1;

          if (aSpan !== bSpan) return bSpan - aSpan;

          const startDiff = aStart.valueOf() - bStart.valueOf();
          if (startDiff !== 0) return startDiff;

          return String(a.id).localeCompare(String(b.id));
        });
    },
    [eventBarsByDate, eventOccursOnDate, expandedEvents, getEventVisualKey, selectedDate]
  );

  const selectedHolidayName = getHolidayDisplayName(holidayMap.get(selectedDate));

  // 날짜별 공휴일/주말 색상 타입 계산
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

  // 모달이 열릴 때 변경 감지 기준 스냅샷 저장
  // 모바일 상단 헤더에 캘린더 목록 드롭다운 연결
  React.useEffect(() => {
    if (mode === "none") {
      openedFormSnapshotRef.current = "";
      return;
    }

    openedFormSnapshotRef.current = JSON.stringify(form);
  }, [mode, modalOpenVersion]);

  // hover 툴팁 긴 텍스트 말줄임 처리
  const ellipsis = (text: string, max = 18) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "..." : text;
  };

  // 일정 hover 툴팁 문구 구성
  const makeTooltipText = (event: ExpandedEvent) => {
    const createdByName = String(event.createdByName ?? "").trim();
    const memo = String(event.memo ?? "").trim();
    const locationName = String(event.locationName ?? "").trim();
    const timeText = event.allDay
      ? "하루 종일"
      : `${dayjs(event.start).format("HH:mm")} - ${dayjs(event.end || event.start).format("HH:mm")}`;

    return [
      `${event.title}`,
      `· 시간: ${timeText}`,
      createdByName ? `· 작성자: ${ellipsis(createdByName)}` : "",
      memo ? `· 메모: ${ellipsis(memo)}` : "",
      locationName ? `· 장소: ${ellipsis(locationName)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  // 일정 hover 레이어 클래스 초기화
  const clearTooltipLayers = () => {
    document.querySelectorAll(".pz-tooltip-layer-open").forEach((el) => {
      el.classList.remove("pz-tooltip-layer-open");
    });
  };

  // 현재 모달 입력값 변경 여부 확인
  const hasUnsavedModalChanges = React.useCallback(() => {
    if (mode === "none" || !openedFormSnapshotRef.current) return false;
    return JSON.stringify(form) !== openedFormSnapshotRef.current;
  }, [form, mode]);

  // 캘린더 뒤로가기 기준 URL 조회
  const getCalendarBaseUrl = React.useCallback(() => {
    return calendarBaseUrlRef.current || getCleanCalendarUrl();
  }, []);

  // 브라우저 뒤로가기 가드용 URL 생성
  const getBackGuardUrl = React.useCallback(() => {
    backGuardSeqRef.current += 1;
    const url = new URL(getCalendarBaseUrl(), window.location.origin);
    url.searchParams.set(BACK_GUARD_PARAM, String(backGuardSeqRef.current));
    return `${url.pathname}${url.search}${BACK_GUARD_HASH_PREFIX}${backGuardSeqRef.current}`;
  }, [getCalendarBaseUrl]);

  // history stack에 뒤로가기 가드 추가
  const pushBackGuard = React.useCallback((count = 1) => {
    if (!canUseCalendarHistoryGuard()) return;

    logBackDebug(`push guard count=${count}`);
    for (let i = 0; i < count; i += 1) {
      window.history.pushState(
        { ...(window.history.state ?? {}), calendarBackGuard: true },
        "",
        getBackGuardUrl()
      );
      backGuardDepthRef.current += 1;
    }
  }, [getBackGuardUrl, logBackDebug]);

  // 필요한 개수만큼 뒤로가기 가드 보강
  const ensureBackGuards = React.useCallback((targetDepth = HOME_BACK_GUARD_DEPTH) => {
    const missing = targetDepth - backGuardDepthRef.current;
    logBackDebug(`ensure guards target=${targetDepth} missing=${missing}`);
    if (missing > 0) pushBackGuard(missing);
  }, [logBackDebug, pushBackGuard]);

  // 캘린더 화면 진입 시 뒤로가기 가드 장착
  const armBackGuard = React.useCallback(() => {
    if (!canUseCalendarHistoryGuard() || historyGuardArmedRef.current) return;

    logBackDebug("arm guard");
    const url = getCalendarBaseUrl();
    window.history.replaceState(
      { ...(window.history.state ?? {}), calendarBase: true },
      "",
      url
    );
    backGuardDepthRef.current = 0;
    ensureBackGuards();
    historyGuardArmedRef.current = true;
  }, [ensureBackGuards, getCalendarBaseUrl]);

  // 모바일 첫 사용자 액션 이후 뒤로가기 가드 재장착
  const rearmBackGuardAfterUserActivation = React.useCallback(() => {
    if (!canUseCalendarHistoryGuard()) return;

    logBackDebug("rearm guard after user activation");
    calendarBaseUrlRef.current = getCleanCalendarUrl();
    historyGuardArmedRef.current = false;
    backGuardDepthRef.current = 0;
    armBackGuard();
  }, [armBackGuard, logBackDebug]);

  // 뒤로가기 확인창 닫기
  const closeBackConfirm = React.useCallback(() => {
    logBackDebug("close modal confirm");
    backConfirmRef.current = null;
    setBackConfirm(null);
  }, [logBackDebug]);

  // 현재 모달 상태를 뒤로가기 복원 스택에 저장
  const rememberCurrentModal = () => {
    if (mode === "none") return;
    modalBackStackRef.current.push({ mode, form: cloneForm(form) });
  };

  // 모바일 일정 상세 화면용 뒤로가기 단계 추가
  const openMobileModalHistoryStep = () => {
    armBackGuard();
    ensureBackGuards(MODAL_BACK_GUARD_DEPTH);
  };

  // 캘린더 화면에서 모달과 복원 스택 닫기
  const closeModalFromCalendar = React.useCallback(() => {
    modalBackStackRef.current = [];
    closeBackConfirm();
    closeModal();
  }, [closeBackConfirm, closeModal]);

  // 수정 중인 모달이 있을 때 전환 전 유실 확인
  const runWithDiscardConfirm = React.useCallback((action: () => void) => {
    if (!hasUnsavedModalChanges()) {
      action();
      return;
    }

    setDiscardConfirm({ onConfirm: action });
  }, [hasUnsavedModalChanges]);

  // 날짜 클릭 시 선택 날짜 변경
  const handleDateSelect = (info: DateClickArg) => {
    clearTooltipLayers();
    removeFloatingTooltip();
    runWithDiscardConfirm(() => {
      setSelectedDate(info.dateStr);
      closeModalFromCalendar();
    });
  };

  // 선택 날짜 일정 클릭 시 상세 모달 열기
  const handleListEventClick = (event: ExpandedEvent) => {
    clearTooltipLayers();
    removeFloatingTooltip();
    runWithDiscardConfirm(() => {
      rememberCurrentModal();
      openMobileModalHistoryStep();
      setModalOpenVersion((version) => version + 1);
      openEventDetail(event);
    });
  };

  // 선택 날짜 기준 새 일정 추가 모달 열기
  const handleCreateClick = () => {
    clearTooltipLayers();
    removeFloatingTooltip();
    runWithDiscardConfirm(() => {
      rememberCurrentModal();
      openMobileModalHistoryStep();
      setModalOpenVersion((version) => version + 1);
      openCreateAtDate(selectedDate);
    });
  };

  // 캘린더 탭 선택과 수정 중 전환 확인 처리
  const handleCalendarTabSelect = React.useCallback((calendar: (typeof calendars)[number]) => {
    if (calendar.calendarId === calendarId) return;

    clearTooltipLayers();
    removeFloatingTooltip();
    runWithDiscardConfirm(() => {
      handleCalendarTabClick(calendar);
      closeModalFromCalendar();
    });
  }, [calendarId, closeModalFromCalendar, handleCalendarTabClick, runWithDiscardConfirm]);

  // 최신 모달 모드를 ref에 동기화
  React.useEffect(() => {
    setMobileHeaderConfig({
      title: calendarName || "캘린더",
      menuItems: calendars.map((calendar) => ({
        id: String(calendar.calendarId),
        label: calendar.name,
        active: calendar.calendarId === calendarId,
        onSelect: () => handleCalendarTabSelect(calendar),
      })),
    });

    return () => {
      resetMobileHeaderConfig();
    };
  }, [
    calendarId,
    calendarName,
    calendars,
    handleCalendarTabSelect,
    resetMobileHeaderConfig,
    setMobileHeaderConfig,
  ]);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // 브라우저 뒤로가기 이벤트를 캘린더 내부 동작으로 변환
  React.useLayoutEffect(() => {
    // 뒤로가기 시 모달 복원/닫기 확인 또는 네이티브 이탈 처리
    const handleBrowserBack = (event: Event) => {
      if (!canUseCalendarHistoryGuard()) return;

      logBackDebug(`event ${event.type}`);
      if (backEventLockRef.current) {
        logBackDebug(`event locked ${event.type}`);
        event.stopImmediatePropagation();
        return;
      }

      backEventLockRef.current = true;
      window.setTimeout(() => {
        backEventLockRef.current = false;
      }, 120);

      if (allowBackStepsRef.current > 0) {
        allowBackStepsRef.current -= 1;
        logBackDebug(`allow native back remaining=${allowBackStepsRef.current}`);
        return;
      }

      if (modeRef.current === "none") {
        logBackDebug("home back -> native beforeunload");
        event.stopImmediatePropagation();
        backGuardDepthRef.current = Math.max(0, backGuardDepthRef.current - 1);
        const exitSteps = Math.max(1, backGuardDepthRef.current + 1);
        allowBackStepsRef.current = exitSteps;
        historyGuardArmedRef.current = false;
        backGuardDepthRef.current = 0;
        window.history.go(-exitSteps);
        return;
      }

      event.stopImmediatePropagation();
      backGuardDepthRef.current = Math.max(0, backGuardDepthRef.current - 1);
      ensureBackGuards(MODAL_BACK_GUARD_DEPTH);

      if (backConfirmRef.current) {
        logBackDebug("back while modal confirm open -> cancel");
        closeBackConfirm();
        return;
      }

      removeFloatingTooltip();
      const nextBackConfirm = {
        action: modalBackStackRef.current.length > 0 ? "restore" : "close",
      } satisfies BackConfirmState;
      logBackDebug(`open modal confirm action=${nextBackConfirm.action}`);
      backConfirmRef.current = nextBackConfirm;
      setBackConfirm(nextBackConfirm);
    };

    window.addEventListener("popstate", handleBrowserBack, true);
    window.addEventListener("hashchange", handleBrowserBack, true);
    return () => {
      window.removeEventListener("popstate", handleBrowserBack, true);
      window.removeEventListener("hashchange", handleBrowserBack, true);
    };
  }, [closeBackConfirm, ensureBackGuards]);

  // 최초 화면 표시 후 캘린더 기준 URL 저장과 가드 장착
  React.useLayoutEffect(() => {
    calendarBaseUrlRef.current = getCleanCalendarUrl();
    armBackGuard();
  }, [armBackGuard]);

  // 모바일 브라우저 첫 상호작용 이후 history guard 보정
  React.useEffect(() => {
    if (!canUseCalendarHistoryGuard()) return;

    // 첫 사용자 입력을 기준으로 가드 재장착
    const handleFirstUserActivation = () => {
      rearmBackGuardAfterUserActivation();
    };

    window.addEventListener("pointerdown", handleFirstUserActivation, {
      capture: true,
      once: true,
    });
    window.addEventListener("touchstart", handleFirstUserActivation, {
      capture: true,
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", handleFirstUserActivation, {
      capture: true,
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", handleFirstUserActivation, true);
      window.removeEventListener("touchstart", handleFirstUserActivation, true);
      window.removeEventListener("keydown", handleFirstUserActivation, true);
    };
  }, [rearmBackGuardAfterUserActivation]);

  // 브라우저 이탈 전 시스템 확인창 호출
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // 새로고침/외부 이탈 전 기본 확인창 표시
    const handleProtectedBeforeUnload = (event: BeforeUnloadEvent) => {
      logBackDebug("beforeunload blocked");
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleProtectedBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleProtectedBeforeUnload);
    };
  }, [logBackDebug]);

  // 뒤로가기 디버그용 페이지 상태 이벤트 기록
  React.useEffect(() => {
    if (!backDebugEnabled || typeof window === "undefined") return;

    // 페이지 숨김 이벤트 디버그 로그 기록
    const handlePageHide = () => logBackDebug("pagehide");

    // 문서 표시 상태 변경 디버그 로그 기록
    const handleVisibilityChange = () => {
      logBackDebug(`visibilitychange=${document.visibilityState}`);
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [backDebugEnabled, logBackDebug]);

  // 뒤로가기 확인창 취소 처리
  const handleCancelBackClose = () => {
    closeBackConfirm();
  };

  // 뒤로가기 확인창 확인 시 이전 모달 복원 또는 닫기
  const handleConfirmBackClose = () => {
    const action = backConfirm?.action;
    closeBackConfirm();

    if (action === "restore") {
      const previous = modalBackStackRef.current.pop();
      if (!previous) {
        closeModal();
        return;
      }

      restoreModal(previous);
      setModalOpenVersion((version) => version + 1);
      openedFormSnapshotRef.current = JSON.stringify(previous.form);
      return;
    }

    modalBackStackRef.current = [];
    closeModal();
  };

  // 일정 목록 hover 시 요약 툴팁 표시
  const handleListEventMouseEnter = (
    event: ExpandedEvent,
    target: React.MouseEvent<HTMLButtonElement>
  ) => {
    showFloatingTooltip(target.currentTarget, makeTooltipText(event));
  };

  // 일정 목록 hover 해제 시 요약 툴팁 제거
  const handleListEventMouseLeave = () => {
    removeFloatingTooltip();
  };

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.calendarPane}>
            {/* 캘린더 탭 */}
            <div className={styles.calendarTabs}>
              {calendars.map((cal) => (
                <button
                  key={cal.calendarId}
                  type="button"
                  className={
                    cal.calendarId === calendarId
                      ? `${styles.calendarTab} ${styles.activeCalendarTab}`
                      : styles.calendarTab
                  }
                  onClick={() => handleCalendarTabSelect(cal)}
                >
                  {cal.name}
                </button>
              ))}
            </div>
            <CalendarView
              calRef={calRef}
              expandedEvents={expandedEvents}
              holidayMap={holidayMap}
              getDayType={getDayType}
              onDateClick={handleDateSelect}
              onDatesSet={(range, year) => {
                setHolidayYear(year);
                setViewRange(range);
              }}
              calendarName={calendarName}
              eventCountByDate={eventCountByDate}
              eventBarsByDate={eventBarsByDate}
              selectedDate={selectedDate}
            />
            {(calendarsLoading || eventsLoading) && (
              <LoadingOverlay variant="calendar" label="일정 로딩 중" />
            )}
          </div>

          <div className={styles.sideRail}>
            {selectedDate && (
              <aside className={styles.dayEventPanel} aria-label="선택한 날짜 일정">
              <div className={styles.dayEventPanelHeader}>
                <div>
                  <div className={styles.dayEventPanelDateRow}>
                    <span className={styles.dayEventPanelDate}>
                      {dayjs(selectedDate).format("YYYY년 M월 D일")}
                    </span>
                    {selectedHolidayName && (
                      <span className={styles.dayEventPanelHoliday}>
                        {selectedHolidayName}
                      </span>
                    )}
                  </div>
                  <div className={styles.dayEventPanelCount}>
                    일정 {selectedDateEvents.length}개
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.dayEventAddButton}
                  onClick={handleCreateClick}
                >
                  추가
                </button>
              </div>

              <div className={styles.dayEventList}>
                {selectedDateEvents.length === 0 ? (
                  <div className={styles.dayEventEmpty}>등록된 일정이 없습니다.</div>
                ) : (
                  selectedDateEvents.map((event) => (
                    <button
                      key={getEventVisualKey(event)}
                      type="button"
                      className={styles.dayEventItem}
                      onClick={() => handleListEventClick(event)}
                      onMouseEnter={(e) => handleListEventMouseEnter(event, e)}
                      onMouseLeave={handleListEventMouseLeave}
                    >
                      <span
                        className={styles.dayEventDot}
                        style={{ backgroundColor: event.color || "#1e2a78" }}
                      />
                      <span className={styles.dayEventText}>
                        <span className={styles.dayEventTitle}>{event.title}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              </aside>
            )}

            {mode !== "none" && (
              <EventModal
                presentation="sideCard"
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
                closeModal={closeModalFromCalendar}
                saveNew={saveNew}
                updateEvent={updateEvent}
                deleteEvent={deleteEvent}
                getDayType={getDayType}
              />
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={!!backConfirm}
        title="입력을 취소하시겠습니까?"
        message="현재 입력하거나 수정하던 내용이 사라질 수 있습니다."
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={handleCancelBackClose}
        onConfirm={handleConfirmBackClose}
      />
      <ConfirmDialog
        open={!!discardConfirm}
        title="입력을 취소하시겠습니까?"
        message="다른 일정 또는 새로운 일정을 열면 현재 수정 내역이 사라집니다. 계속하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDiscardConfirm(null)}
        onConfirm={() => {
          const action = discardConfirm?.onConfirm;
          setDiscardConfirm(null);
          action?.();
        }}
      />
      {backDebugEnabled && (
        <div
          style={{
            position: "fixed",
            left: 8,
            right: 8,
            bottom: 8,
            zIndex: 30000,
            maxHeight: "42vh",
            overflow: "auto",
            padding: 8,
            border: "1px solid rgba(125, 227, 223, 0.8)",
            borderRadius: 8,
            background: "rgba(13, 18, 29, 0.92)",
            color: "#d7fffb",
            fontSize: 10,
            lineHeight: 1.35,
            whiteSpace: "pre-wrap",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong>calendar back debug</strong>
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem(BACK_DEBUG_STORAGE_KEY);
                setBackDebugLines([]);
              }}
              style={{
                border: "1px solid rgba(125, 227, 223, 0.7)",
                borderRadius: 6,
                background: "transparent",
                color: "#d7fffb",
                fontSize: 10,
                padding: "2px 6px",
              }}
            >
              clear
            </button>
          </div>
          {"\n"}
          {backDebugLines.length === 0 ? "no events yet" : backDebugLines.join("\n")}
        </div>
      )}
    </div>
  );
};

export default Calendar;

