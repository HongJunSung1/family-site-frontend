import React, { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { DateClickArg } from "@fullcalendar/interaction";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";

import { useCalendarData } from "./calendar/hooks/useCalendarData";
import { useCalendarEventForm } from "./calendar/hooks/useCalendarEventForm";
import { useHolidays } from "./calendar/hooks/useHolidays";
import { ConfirmDialog } from "../../common/components/ConfirmDialog";
import { CalendarView } from "./calendar/components/CalendarView";
import { EventModal } from "./calendar/components/EventModal";
import { expandRecurringEvents } from "./calendar/utils/recurrence";
import type { ExpandedEvent } from "./calendar/utils/recurrence";
import type { FormState, ModalMode } from "./calendar/types";

import styles from "./Calendar.module.css";

dayjs.locale("ko");

const EVENT_TOOLTIP_ID = "pz-floating-event-tooltip";

const removeFloatingTooltip = () => {
  document.getElementById(EVENT_TOOLTIP_ID)?.remove();
};

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

const canUseCalendarHistoryGuard = () => typeof window !== "undefined";

const cloneForm = (form: FormState): FormState => JSON.parse(JSON.stringify(form)) as FormState;

const Calendar: React.FC = () => {
  const calRef = useRef<FullCalendar | null>(null);

  const [formError, setFormError] = useState<string>("");
  const [holidayYear, setHolidayYear] = useState<number>(dayjs().year());
  const [selectedDate, setSelectedDate] = useState<string>(() => dayjs().format("YYYY-MM-DD"));
  const [modalOpenVersion, setModalOpenVersion] = useState(0);
  const [backConfirm, setBackConfirm] = useState<BackConfirmState | null>(null);
  const [homeExitConfirmOpen, setHomeExitConfirmOpen] = useState(false);
  const openedFormSnapshotRef = useRef<string>("");
  const modalBackStackRef = useRef<ModalSnapshot[]>([]);
  const backConfirmRef = useRef<BackConfirmState | null>(null);
  const homeExitConfirmOpenRef = useRef(false);
  const allowNextBackRef = useRef(false);
  const calendarPageUrlRef = useRef("");
  const historyGuardDepthRef = useRef(0);
  const modeRef = useRef<ModalMode>("none");
  const [viewRange, setViewRange] = useState<{ start: Dayjs; end: Dayjs }>(() => {
    const now = dayjs();
    return { start: now.startOf("month"), end: now.endOf("month").add(1, "day") };
  });

  const { holidaySet, holidayMap } = useHolidays(holidayYear);

  // 로그인 사용자와 현재 캘린더의 이벤트 목록을 관리한다.
  const {
    events,
    userId,
    calendars,
    calendarId,
    calendarName,
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

  const expandedEvents = useMemo(
    () => expandRecurringEvents(events, viewRange.start, viewRange.end),
    [events, viewRange.start, viewRange.end]
  );

  const eventOccursOnDate = React.useCallback((event: ExpandedEvent, ymd: string) => {
    const day = dayjs(ymd);
    const start = dayjs(event.start).startOf("day");
    const end = dayjs(event.end || event.start).startOf("day");
    return !day.isBefore(start, "day") && !day.isAfter(end, "day");
  }, []);

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
        const key = `${event.id}-${event.__occKey ?? event.start}`;
        const spanDays: string[] = [];

        let spanCursor = firstDay;
        while (!spanCursor.isAfter(lastDay, "day")) {
          spanDays.push(spanCursor.format("YYYY-MM-DD"));
          spanCursor = spanCursor.add(1, "day");
        }

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
  }, [expandedEvents, viewRange.start, viewRange.end]);

  const selectedDateEvents = useMemo(
    () =>
      expandedEvents
        .filter((event) => eventOccursOnDate(event, selectedDate))
        .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf()),
    [eventOccursOnDate, expandedEvents, selectedDate]
  );

  const selectedHolidayName = getHolidayDisplayName(holidayMap.get(selectedDate));

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

  React.useEffect(() => {
    if (mode === "none") {
      openedFormSnapshotRef.current = "";
      return;
    }

    openedFormSnapshotRef.current = JSON.stringify(form);
  }, [mode, modalOpenVersion]);

  const ellipsis = (text: string, max = 18) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "..." : text;
  };

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

  const clearTooltipLayers = () => {
    document.querySelectorAll(".pz-tooltip-layer-open").forEach((el) => {
      el.classList.remove("pz-tooltip-layer-open");
    });
  };

  const hasUnsavedModalChanges = () => {
    if (mode === "none" || !openedFormSnapshotRef.current) return false;
    return JSON.stringify(form) !== openedFormSnapshotRef.current;
  };

  const pushBackGuard = React.useCallback(() => {
    if (!canUseCalendarHistoryGuard()) return;

    const url =
      calendarPageUrlRef.current ||
      `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState(
      { ...(window.history.state ?? {}), calendarBackGuard: true },
      "",
      url
    );
    historyGuardDepthRef.current += 1;
  }, []);

  const closeBackConfirm = React.useCallback(() => {
    backConfirmRef.current = null;
    setBackConfirm(null);
  }, []);

  const closeHomeExitConfirm = React.useCallback(() => {
    homeExitConfirmOpenRef.current = false;
    setHomeExitConfirmOpen(false);
  }, []);

  const rememberCurrentModal = () => {
    if (mode === "none") return;
    modalBackStackRef.current.push({ mode, form: cloneForm(form) });
  };

  const openMobileModalHistoryStep = () => {
    pushBackGuard();
  };

  const closeModalFromCalendar = React.useCallback(() => {
    modalBackStackRef.current = [];
    closeBackConfirm();
    closeModal();
  }, [closeBackConfirm, closeModal]);

  const confirmDiscardIfNeeded = () => {
    if (!hasUnsavedModalChanges()) return true;

    return window.confirm(
      "다른 일정 또는 새로운 일정을 열면 현재 수정 내역이 사라집니다. 계속하시겠습니까?"
    );
  };

  const handleDateSelect = (info: DateClickArg) => {
    clearTooltipLayers();
    removeFloatingTooltip();
    if (!confirmDiscardIfNeeded()) return;
    setSelectedDate(info.dateStr);
    closeModalFromCalendar();
  };

  const handleListEventClick = (event: ExpandedEvent) => {
    clearTooltipLayers();
    removeFloatingTooltip();
    if (!confirmDiscardIfNeeded()) return;
    rememberCurrentModal();
    openMobileModalHistoryStep();
    setModalOpenVersion((version) => version + 1);
    openEventDetail(event);
  };

  const handleCreateClick = () => {
    clearTooltipLayers();
    removeFloatingTooltip();
    if (!confirmDiscardIfNeeded()) return;
    rememberCurrentModal();
    openMobileModalHistoryStep();
    setModalOpenVersion((version) => version + 1);
    openCreateAtDate(selectedDate);
  };

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!canUseCalendarHistoryGuard()) return;

      if (allowNextBackRef.current) {
        allowNextBackRef.current = false;
        return;
      }

      event.stopImmediatePropagation();
      pushBackGuard();

      if (backConfirmRef.current) {
        closeBackConfirm();
        return;
      }

      if (homeExitConfirmOpenRef.current) {
        closeHomeExitConfirm();
        return;
      }

      if (modeRef.current === "none") {
        homeExitConfirmOpenRef.current = true;
        setHomeExitConfirmOpen(true);
        return;
      }

      removeFloatingTooltip();
      const nextBackConfirm = {
        action: modalBackStackRef.current.length > 0 ? "restore" : "close",
      } satisfies BackConfirmState;
      backConfirmRef.current = nextBackConfirm;
      setBackConfirm(nextBackConfirm);
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  }, [closeBackConfirm, closeHomeExitConfirm, pushBackGuard]);

  React.useLayoutEffect(() => {
    calendarPageUrlRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (historyGuardDepthRef.current > 0 || !canUseCalendarHistoryGuard()) return;
    pushBackGuard();
  }, [pushBackGuard]);

  React.useLayoutEffect(() => {
    if (mode === "none" || historyGuardDepthRef.current > 0 || !canUseCalendarHistoryGuard()) return;
    pushBackGuard();
  }, [mode, pushBackGuard]);

  const handleCancelBackClose = () => {
    closeBackConfirm();
  };

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

  const handleCancelHomeExit = () => {
    closeHomeExitConfirm();
  };

  const handleConfirmHomeExit = () => {
    closeHomeExitConfirm();
    allowNextBackRef.current = true;
    const depth = Math.max(1, historyGuardDepthRef.current);
    historyGuardDepthRef.current = 0;
    window.history.go(-depth);
  };

  const handleListEventMouseEnter = (
    event: ExpandedEvent,
    target: React.MouseEvent<HTMLButtonElement>
  ) => {
    showFloatingTooltip(target.currentTarget, makeTooltipText(event));
  };

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
                  onClick={() => handleCalendarTabClick(cal)}
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
                      key={`${event.id}-${event.__occKey ?? event.start}`}
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
        open={homeExitConfirmOpen}
        title="홈페이지를 나가시겠습니까?"
        message="현재 페이지를 벗어나면 이전 화면으로 이동합니다."
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={handleCancelHomeExit}
        onConfirm={handleConfirmHomeExit}
      />
    </div>
  );
};

export default Calendar;

