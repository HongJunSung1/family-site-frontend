import FullCalendar from "@fullcalendar/react";
import type { EventClickArg, EventHoveringArg, EventMountArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

import type { DayType, ViewRange } from "../types";
import type { ExpandedEvent } from "../utils/recurrence";
import styles from "../../Calendar.module.css";

// 배경색 기준 읽기 쉬운 텍스트 색상 계산
const getReadableTextColor = (bgColor?: string) => {
  if (!bgColor) return "#ffffff";

  let hex = bgColor.replace("#", "").trim();

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (hex.length !== 6) return "#ffffff";

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness >= 160 ? "#111827" : "#ffffff";
};

// FullCalendar 기본 popover 제거
const closeCalendarPopovers = () => {
  document.querySelectorAll<HTMLElement>(".fc-popover").forEach((popover) => {
    popover.remove();
  });
};

// 렌더 타이밍 차이를 고려한 popover 반복 제거
const closeCalendarPopoversReliably = () => {
  closeCalendarPopovers();
  window.requestAnimationFrame(closeCalendarPopovers);
  window.setTimeout(closeCalendarPopovers, 0);
};

type CalendarDisplayState = {
  isMobileCalendar: boolean;
};

// 현재 화면 너비 기준 캘린더 표시 상태 계산
const getCalendarDisplayState = () => {
  if (typeof window === "undefined") {
    return { isMobileCalendar: false };
  }

  const isMobileCalendar = window.innerWidth <= 768;

  if (isMobileCalendar) {
    return { isMobileCalendar };
  }

  return { isMobileCalendar };
};


type Props = {
  calRef: React.RefObject<FullCalendar | null>;
  expandedEvents: ExpandedEvent[];
  holidayMap: Map<string, string>;
  getDayType: (d: Dayjs) => DayType;
  onDateClick: (info: DateClickArg) => void;
  onEventClick: (info: EventClickArg) => void;
  onEventMouseEnter?: (info: EventHoveringArg) => void;
  onEventMouseLeave?: (info: EventHoveringArg) => void;
  onEventDidMount?: (info: EventMountArg) => void;
  onDatesSet: (range: ViewRange, holidayYear: number) => void;

  calendarName: string;
  eventCountByDate: Map<string, number>;
  selectedDate: string;
};

// 이전 FullCalendar 월간 화면 구현
export function CalendarView({
  calRef,
  expandedEvents,
  holidayMap,
  getDayType,
  onDateClick,
  onEventClick,
  onEventDidMount,
  onEventMouseEnter,
  onEventMouseLeave,
  onDatesSet,
  calendarName,
  eventCountByDate,
  selectedDate,
}: Props) {
  const [, setCalendarDisplay] = useState<CalendarDisplayState>(getCalendarDisplayState);

  // 화면 크기 변경 시 캘린더 표시 상태 갱신
  useEffect(() => {
    // 캘린더 표시 상태 최신화
    const updateCalendarDisplay = () => setCalendarDisplay(getCalendarDisplayState());

    updateCalendarDisplay();
    window.addEventListener("resize", updateCalendarDisplay);

    return () => {
      window.removeEventListener("resize", updateCalendarDisplay);
    };
  }, []);

  // FullCalendar popover 닫기 버튼 클릭 처리
  useEffect(() => {
    // popover 닫기 버튼 클릭 시 popover 제거
    const handlePopoverCloseClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".fc-popover-close")) return;

      closeCalendarPopovers();
    };

    document.addEventListener("click", handlePopoverCloseClick);
    document.addEventListener("touchend", handlePopoverCloseClick);

    return () => {
      document.removeEventListener("click", handlePopoverCloseClick);
      document.removeEventListener("touchend", handlePopoverCloseClick);
    };
  }, []);

  // 일정 클릭 시 popover 정리 후 상위 클릭 처리 호출
  const handleEventClick = (info: EventClickArg) => {
    closeCalendarPopoversReliably();

    onEventClick(info);
  };

  return (
    <div className={styles.calendarShell}>
      <div className={styles.calendarNameHeader}>
        {calendarName}
      </div>
      <FullCalendar
        key={holidayMap.size}
        ref={calRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        height="100%"
        locale="ko"
        customButtons={{
          myToday: {
            text: "📆",
            hint: "오늘 날짜로 이동",
            click: () => calRef.current?.getApi().today(),
          },
          
        }}
        headerToolbar={{
          left: "title",
          center: "myToday prev,next",
          right: "",
        }}
        datesSet={(arg) => {
          const y = dayjs(arg.start).add(10, "day").year();
          onDatesSet({ start: dayjs(arg.start), end: dayjs(arg.end) }, y);
          
        }}
        dayCellDidMount={(arg) => {
          const ymd = dayjs(arg.date).format("YYYY-MM-DD");
          const name = holidayMap.get(ymd);
          const frame = arg.el.querySelector(".fc-daygrid-day-frame") as HTMLElement | null;
          const target = frame ?? (arg.el as HTMLElement);

          if (name) {
            target.dataset.holiday = name;
            target.classList.add("pz-holiday-tip");
          } else {
            delete target.dataset.holiday;
            target.classList.remove("pz-holiday-tip");
          }
        }}
        dayCellContent={(arg) => {
          const ymd = dayjs(arg.date).format("YYYY-MM-DD");
          const count = eventCountByDate.get(ymd) ?? 0;
          const dayNumber = arg.dayNumberText.replace("일", "");

          return (
            <div className={styles.dayCellContent}>
              <span className={styles.dayNumberText}>{dayNumber}</span>
              {count > 0 && <span className={styles.dayEventCount}>{count}개</span>}
            </div>
          );
        }}
       
        dateClick={onDateClick}
        eventClick={handleEventClick}
        eventDidMount={onEventDidMount}
        eventMouseEnter={onEventMouseEnter}
        eventMouseLeave={onEventMouseLeave}
        eventContent={(arg) => (
          <span
            className={styles.eventColorMarker}
            style={{ backgroundColor: arg.event.backgroundColor || "#1e2a78" }}
            title={arg.event.title}
            aria-label={arg.event.title}
          />
        )}
        displayEventTime={false}
        displayEventEnd={false}
        dayCellClassNames={(arg) => {
          const d = dayjs(arg.date);
          const t = getDayType(d);
          const classes = [];
          if (t === "red") classes.push("pz-day-red");
          else if (t === "blue") classes.push("pz-day-blue");
          else classes.push("pz-day-black");
          if (d.format("YYYY-MM-DD") === selectedDate) classes.push("pz-day-selected");
          return classes;
        }}
        dayHeaderClassNames={(arg) => {
          const d = dayjs(arg.date);
          const dow = d.day();
          if (dow === 0) return ["pz-dow-red"];
          if (dow === 6) return ["pz-dow-blue"];
          return ["pz-dow-black"];
        }}
        eventDisplay="block"
 events={expandedEvents.map((e) => {
  const bgColor = e.color || "#1e2a78";

  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: bgColor,
    borderColor: bgColor,
    textColor: getReadableTextColor(bgColor),
    extendedProps: {
      memo: e.memo,
      startRaw: e.start,
      endRaw: e.end,
      createdBy: e.createdBy,
      createdByName: e.createdByName,
      locationName: e.locationName,
      masterId: e.__masterId ?? e.id,
      occKey: e.__occKey ?? "",
      repeat: e.repeat ?? "none",
      repeatInterval: e.repeatInterval ?? 1,
      repeatRangeStart: e.repeatRangeStart ?? "",
      repeatRangeEnd: e.repeatRangeEnd ?? "",
    },
  };
})}
        dayMaxEvents={false}
        moreLinkContent={() => ""}
        expandRows={true} // 주(행) 높이를 동일하게 분배
        fixedWeekCount={true}   // 5~6주 고정(월뷰에서 행 높이 안정)
        moreLinkClick="popover"
      />
    </div>
  );
}
