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

const closeCalendarPopovers = () => {
  document.querySelectorAll<HTMLElement>(".fc-popover").forEach((popover) => {
    popover.remove();
  });
};

const closeCalendarPopoversReliably = () => {
  closeCalendarPopovers();
  window.requestAnimationFrame(closeCalendarPopovers);
  window.setTimeout(closeCalendarPopovers, 0);
};

type CalendarDisplayState = {
  isMobileCalendar: boolean;
  dayMaxEvents: number;
};

const getCalendarDisplayState = () => {
  if (typeof window === "undefined") {
    return { isMobileCalendar: false, dayMaxEvents: 3 };
  }

  const isMobileCalendar = window.innerWidth <= 768;

  if (isMobileCalendar) {
    return { isMobileCalendar, dayMaxEvents: 1 };
  }

  return { isMobileCalendar, dayMaxEvents: 1 };
};


type Props = {
  calRef: React.RefObject<FullCalendar | null>;
  expandedEvents: ExpandedEvent[];
  holidayMap: Map<string, string>;
  getDayType: (d: Dayjs) => DayType;
  onDateClick: (info: DateClickArg) => void;
  onEventClick: (info: EventClickArg) => void;
  onEventMouseEnter: (info: EventHoveringArg) => void;
  onEventMouseLeave: (info: EventHoveringArg) => void;
  onEventDidMount?: (info: EventMountArg) => void;
  onDatesSet: (range: ViewRange, holidayYear: number) => void;

  calendarName: string;
};


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
}: Props) {
  const [calendarDisplay, setCalendarDisplay] = useState<CalendarDisplayState>(getCalendarDisplayState);

  useEffect(() => {
    const updateCalendarDisplay = () => setCalendarDisplay(getCalendarDisplayState());

    updateCalendarDisplay();
    window.addEventListener("resize", updateCalendarDisplay);

    return () => {
      window.removeEventListener("resize", updateCalendarDisplay);
    };
  }, []);

  useEffect(() => {
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
       
        dateClick={onDateClick}
        eventClick={handleEventClick}
        eventDidMount={onEventDidMount}
        eventMouseEnter={onEventMouseEnter}
        eventMouseLeave={onEventMouseLeave}
        displayEventTime={false}
        displayEventEnd={false}
        dayCellClassNames={(arg) => {
          const d = dayjs(arg.date);
          const t = getDayType(d);
          if (t === "red") return ["pz-day-red"];
          if (t === "blue") return ["pz-day-blue"];
          return ["pz-day-black"];
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
    },
  };
})}
        dayMaxEvents={calendarDisplay.dayMaxEvents}
        moreLinkContent={() => "..."}
        expandRows={true} // 주(행) 높이를 동일하게 분배
        fixedWeekCount={true}   // 5~6주 고정(월뷰에서 행 높이 안정)
        moreLinkClick="popover"
      />
    </div>
  );
}
