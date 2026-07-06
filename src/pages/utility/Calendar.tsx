import React, { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventApi, EventHoveringArg, EventMountArg } from "@fullcalendar/core";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";

import { useCalendarData } from "./calendar/hooks/useCalendarData";
import { useCalendarEventForm } from "./calendar/hooks/useCalendarEventForm";
import { useHolidays } from "./calendar/hooks/useHolidays";
import { CalendarView } from "./calendar/components/CalendarView";
import { EventModal } from "./calendar/components/EventModal";
import { expandRecurringEvents } from "./calendar/utils/recurrence";

import styles from "./Calendar.module.css";

dayjs.locale("ko");

const Calendar: React.FC = () => {
  const calRef = useRef<FullCalendar | null>(null);

  const [formError, setFormError] = useState<string>("");
  const [holidayYear, setHolidayYear] = useState<number>(dayjs().year());
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
    onDateClick,
    onEventClick,
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

  // 데이터 업데이트 시 바로 툴팁 업데이트 되도록 유지한다.
  const makeTooltipText = (event: EventApi) => {
    const createdByName = String(event.extendedProps?.createdByName ?? "").trim();
    const memo = String(event.extendedProps?.memo ?? "").trim();
    const locationName = String(event.extendedProps?.locationName ?? "").trim();

    const ellipsis = (text: string, max = 13) => {
      if (!text) return "";
      return text.length > max ? text.slice(0, max) + "..." : text;
    };

    return [
      `${event.title}`,
      createdByName ? `· 작성자: ${ellipsis(createdByName)}` : "",
      memo ? `· 메모: ${ellipsis(memo)}` : "",
      locationName ? `· 장소: ${ellipsis(locationName)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const applyTooltip = (info: EventMountArg | EventHoveringArg) => {
    const tooltipText = makeTooltipText(info.event);

    info.el.classList.add(styles.eventMemoTooltip);

    if (tooltipText) {
      info.el.setAttribute("data-memo", tooltipText);
    } else {
      info.el.removeAttribute("data-memo");
    }
  };

  // 일정 안의 내용을 툴팁으로 간략하게 보여준다.
  const onEventDidMount = (info: EventMountArg) => {
    applyTooltip(info);
  };

  const onEventMouseEnter = (info: EventHoveringArg) => {
    applyTooltip(info);
  };

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.card}>
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
            onDateClick={onDateClick}
            onEventClick={onEventClick}
            onEventDidMount={onEventDidMount}
            onEventMouseEnter={onEventMouseEnter}
            onDatesSet={(range, year) => {
              setHolidayYear(year);
              setViewRange(range);
            }}
            calendarName={calendarName}
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

