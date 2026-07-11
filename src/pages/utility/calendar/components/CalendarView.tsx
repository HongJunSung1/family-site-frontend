import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import { useEffect, useRef } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

import type { DayType, ViewRange } from "../types";
import type { ExpandedEvent } from "../utils/recurrence";
import styles from "../../Calendar.module.css";

type EventBar = {
  key: string;
  color: string;
  isStart: boolean;
  isEnd: boolean;
  lane: number;
};

type Props = {
  calRef: React.RefObject<FullCalendar | null>;
  expandedEvents: ExpandedEvent[];
  holidayMap: Map<string, string>;
  getDayType: (d: Dayjs) => DayType;
  onDateClick: (info: DateClickArg) => void;
  onDatesSet: (range: ViewRange, holidayYear: number) => void;
  calendarName: string;
  eventCountByDate: Map<string, number>;
  eventBarsByDate: Map<string, EventBar[]>;
  selectedDate: string;
};

// FullCalendar 월간 화면과 날짜칸 부가 표시 관리
export function CalendarView({
  calRef,
  holidayMap,
  getDayType,
  onDateClick,
  onDatesSet,
  calendarName,
  eventCountByDate,
  eventBarsByDate,
  selectedDate,
}: Props) {
  const shellRef = useRef<HTMLDivElement | null>(null);

  // 공휴일 표시명 보정
  const getHolidayDisplayName = (name: string) => {
    if (name === "기독탄신일") return "크리스마스";
    return name;
  };

  // 날짜칸의 공휴일명, 일정 막대, 일정 개수 표시
  const renderCellExtras = (ymd: string, cellEl: HTMLElement) => {
    const frame = cellEl.querySelector(".fc-daygrid-day-frame") as HTMLElement | null;
    const target = frame ?? cellEl;
    const name = holidayMap.get(ymd);
    const bars = eventBarsByDate.get(ymd) ?? [];
    const count = eventCountByDate.get(ymd) ?? 0;

    target
      .querySelectorAll<HTMLElement>('[data-calendar-cell-extra="true"]')
      .forEach((el) => el.remove());

    delete target.dataset.holiday;
    target.classList.remove("pz-holiday-tip");

    if (name) {
      const holidayLabel = document.createElement("span");
      holidayLabel.className = styles.holidayLabel;
      holidayLabel.dataset.calendarCellExtra = "true";
      holidayLabel.textContent = getHolidayDisplayName(name);
      target.appendChild(holidayLabel);
    }

    if (bars.length > 0) {
      const barsWrap = document.createElement("div");
      barsWrap.className = styles.dayEventBars;
      barsWrap.dataset.calendarCellExtra = "true";
      barsWrap.setAttribute("aria-hidden", "true");

      bars.forEach((bar) => {
        const barEl = document.createElement("span");
        barEl.className = [
          styles.dayEventBar,
          bar.isStart ? styles.dayEventBarStart : "",
          bar.isEnd ? styles.dayEventBarEnd : "",
          !bar.isStart && !bar.isEnd ? styles.dayEventBarMiddle : "",
        ].join(" ");
        barEl.style.backgroundColor = bar.color;
        barEl.style.setProperty("--bar-lane", String(bar.lane));
        barsWrap.appendChild(barEl);
      });

      target.appendChild(barsWrap);
    }

    if (count > 0) {
      const countEl = document.createElement("span");
      countEl.className = styles.dayEventCount;
      countEl.dataset.calendarCellExtra = "true";
      countEl.textContent = String(count);
      target.appendChild(countEl);
    }
  };

  // 데이터 변경 후 현재 보이는 날짜칸 부가 표시 동기화
  useEffect(() => {
    // 화면에 표시된 모든 날짜칸의 부가 표시 재적용
    const syncVisibleCells = () => {
      shellRef.current
        ?.querySelectorAll<HTMLElement>(".fc-daygrid-day[data-date]")
        .forEach((cell) => {
          const ymd = cell.dataset.date;
          if (!ymd) return;
          renderCellExtras(ymd, cell);
        });
    };

    syncVisibleCells();
    const raf = window.requestAnimationFrame(syncVisibleCells);
    return () => window.cancelAnimationFrame(raf);
  }, [holidayMap, eventBarsByDate, eventCountByDate]);

  return (
    <div ref={shellRef} className={styles.calendarShell}>
      <div className={styles.calendarNameHeader}>{calendarName}</div>
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        height="100%"
        locale="ko"
        customButtons={{
          myToday: {
            text: "오늘",
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
          renderCellExtras(ymd, arg.el as HTMLElement);
        }}
        dayCellContent={(arg) => {
          const dayNumber = arg.dayNumberText.replace("일", "");

          return (
            <div className={styles.dayCellContent}>
              <span className={styles.dayNumberText}>{dayNumber}</span>
            </div>
          );
        }}
        dateClick={onDateClick}
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
        events={[]}
        expandRows={true}
        fixedWeekCount={true}
      />
    </div>
  );
}
