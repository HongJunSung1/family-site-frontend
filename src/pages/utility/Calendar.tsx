// Calendar.tsx
import React, { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";

import Switch from "@mui/material/Switch";

dayjs.locale("ko");

type RepeatType = "none" | "daily" | "weekly" | "monthly" | "yearly";

type CalEvent = {
  id: string;
  title: string;
  start: string; // ISO (YYYY-MM-DDTHH:mm)
  end?: string; // ISO
  allDay: boolean;
  memo?: string;
  repeat?: RepeatType;
  color?: string;
  createdBy: string;
};

type ModalMode = "none" | "create" | "detail";
type PickerTarget = "none" | "startDate" | "startTime" | "endDate" | "endTime";

type FormState = {
  id: string;
  title: string;
  start: string; // YYYY-MM-DDTHH:mm
  end: string; // YYYY-MM-DDTHH:mm
  memo: string;
  repeat: RepeatType;
  color: string;
  createdBy: string;
  allDay: boolean;
  prevStartTime: string; // allDay 토글 OFF 시 복원용
  prevEndTime: string; // allDay 토글 OFF 시 복원용
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// ISO(YYYY-MM-DD or YYYY-MM-DDTHH:mm(:ss)) -> Dayjs
const toDayjs = (iso: string): Dayjs => {
  if (!iso) return dayjs();
  if (iso.includes("T")) return dayjs(iso);
  return dayjs(`${iso}T00:00`);
};

const formatISO = (d: Dayjs) => d.format("YYYY-MM-DDTHH:mm");

// "오전/오후 h:mm" 표시용
const formatKoreanTimeLabel = (d: Dayjs) => {
  const h24 = d.hour();
  const m = d.minute();
  const isPM = h24 >= 12;
  const meridiem = isPM ? "오후" : "오전";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${meridiem} ${h12}:${pad2(m)}`;
};

// "2월 12일 (목)" 표시용
const formatKoreanDateLabel = (d: Dayjs) => d.format("M월 D일 (ddd)");

const addHours = (d: Dayjs, hours: number) => d.add(hours, "hour");

function textPillBtnStyle(active: boolean): React.CSSProperties {
  return {
    border: "1px solid rgba(0,0,0,0.10)",
    background: active ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.03)",
    padding: "10px 12px",
    borderRadius: 999,
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1.1,
  };
}

/* =============================================================================
   WheelTimePicker (모달에서만 사용)
   - 컴포넌트 밖에 선언: 리렌더 시 언마운트 방지
   - 클릭 시 선택값 하이라이트 + 해당 컬럼만 중앙 정렬(smooth)
   - 외부 value 변경(시작/종료 전환 등) 시: scrollTop을 "동기"로만 맞춰 깜빡임 최소화
============================================================================= */
type WheelTimePickerProps = {
  value: Dayjs;
  onChange: (next: Dayjs) => void;
  minutesStep?: number;
};

const WheelTimePicker: React.FC<WheelTimePickerProps> = React.memo(
  ({ value, onChange, minutesStep = 5 }) => {
    const ITEM_H = 44;
    const VISIBLE = 5;
    const PAD = ((VISIBLE - 1) / 2) * ITEM_H; // 위/아래 여백
    const CENTER_OFFSET = Math.floor(VISIBLE / 2) * ITEM_H; // 중앙 오프셋(5칸이면 2칸)

    const minuteOptions = React.useMemo(() => {
      const arr: number[] = [];
      for (let m = 0; m < 60; m += minutesStep) arr.push(m);
      return arr;
    }, [minutesStep]);

    // value(24h) -> (오전/오후, 1~12, minute(step))
    const derived = React.useMemo(() => {
      const h24 = value.hour();
      const m = value.minute();

      const mer: "오전" | "오후" = h24 >= 12 ? "오후" : "오전";
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;

      const nearestMin = minuteOptions.reduce(
        (best, cur) => (Math.abs(cur - m) < Math.abs(best - m) ? cur : best),
        minuteOptions[0]
      );

      return { mer, h12, min: nearestMin };
    }, [value, minuteOptions]);

    const [mer, setMer] = React.useState<"오전" | "오후">(derived.mer);
    const [h12, setH12] = React.useState<number>(derived.h12);
    const [min, setMin] = React.useState<number>(derived.min);

    const merRef = React.useRef<HTMLDivElement | null>(null);
    const hourRef = React.useRef<HTMLDivElement | null>(null);
    const minRef = React.useRef<HTMLDivElement | null>(null);

    const setScrollTopIfNeeded = (el: HTMLDivElement | null, targetTop: number) => {
      if (!el) return;
      if (Math.abs(el.scrollTop - targetTop) < 0.5) return; // 불필요한 미세 갱신 방지
      el.scrollTop = targetTop; // 동기 적용(깜빡임 최소화)
    };

    const scrollToCenter = React.useCallback(
      (el: HTMLDivElement | null, idx: number, smooth: boolean) => {
        if (!el) return;
        const target = PAD + idx * ITEM_H - CENTER_OFFSET;
        el.scrollTo({
          top: Math.max(0, target),
          behavior: smooth ? "smooth" : "auto",
        });
      },
      [PAD, ITEM_H, CENTER_OFFSET]
    );

    // 외부 value 변경 시: 값 + 스크롤(동기)만 맞춤
    React.useLayoutEffect(() => {
      setMer(derived.mer);
      setH12(derived.h12);
      setMin(derived.min);

      const merIdx = derived.mer === "오전" ? 0 : 1;
      const hourIdx = derived.h12 - 1;
      const minIdx = Math.max(0, minuteOptions.indexOf(derived.min));

      const merTop = Math.max(0, PAD + merIdx * ITEM_H - CENTER_OFFSET);
      const hourTop = Math.max(0, PAD + hourIdx * ITEM_H - CENTER_OFFSET);
      const minTop = Math.max(0, PAD + minIdx * ITEM_H - CENTER_OFFSET);

      setScrollTopIfNeeded(merRef.current, merTop);
      setScrollTopIfNeeded(hourRef.current, hourTop);
      setScrollTopIfNeeded(minRef.current, minTop);
    }, [derived.mer, derived.h12, derived.min, minuteOptions, PAD, ITEM_H, CENTER_OFFSET]);

    const to24h = (m_: "오전" | "오후", h12_: number) => {
      if (m_ === "오전") return h12_ === 12 ? 0 : h12_;
      return h12_ === 12 ? 12 : h12_ + 12;
    };

    const commit = (nextMer: "오전" | "오후", nextH12: number, nextMin: number) => {
      const h24 = to24h(nextMer, nextH12);
      onChange(value.hour(h24).minute(nextMin).second(0));
    };

    // 11 <-> 12 넘어갈 때 오전/오후 자동 토글(클릭 기반)
    const autoFlipMerIfNeeded = (prevH: number, nextH: number, curMer: "오전" | "오후") => {
      if ((prevH === 11 && nextH === 12) || (prevH === 12 && nextH === 11)) {
        return curMer === "오전" ? "오후" : "오전";
      }
      return curMer;
    };

    const colStyle: React.CSSProperties = {
      height: ITEM_H * VISIBLE,
      width: 110,
      overflowY: "auto",
      borderRadius: 12,
      background: "rgba(0,0,0,0.03)",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      WebkitOverflowScrolling: "touch",
    };

    const itemBase: React.CSSProperties = {
      height: ITEM_H,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 34,
      fontWeight: 700,
      color: "rgba(0,0,0,0.35)",
      userSelect: "none",
      cursor: "pointer",
      borderRadius: 12,
      margin: "0 10px",
      background: "transparent",
      border: "none",
      outline: "none",
    };

    const itemSelected: React.CSSProperties = {
      color: "rgba(0,0,0,0.90)",
      background: "rgba(30,42,120,0.12)",
    };

    const spacer: React.CSSProperties = { height: PAD };

    return (
      <div style={{ display: "flex", gap: 14, justifyContent: "center", padding: "10px 0" }}>
        <style>{`
          .wtp-col::-webkit-scrollbar { display: none; }
        `}</style>

        {/* 오전/오후 */}
        <div className="wtp-col" ref={merRef} style={colStyle}>
          <div style={spacer} />
          {(["오전", "오후"] as const).map((v, idx) => {
            const isSelected = v === mer;
            return (
              <div
                key={v}
                style={{ ...itemBase, ...(isSelected ? itemSelected : {}) }}
                onClick={() => {
                  setMer(v);
                  commit(v, h12, min);
                  scrollToCenter(merRef.current, idx, true); // 이 컬럼만 중앙
                }}
              >
                {v}
              </div>
            );
          })}
          <div style={spacer} />
        </div>

        {/* 시(1~12) */}
        <div className="wtp-col" ref={hourRef} style={colStyle}>
          <div style={spacer} />
          {Array.from({ length: 12 }, (_, i) => i + 1).map((v, idx) => {
            const isSelected = v === h12;
            return (
              <div
                key={v}
                style={{ ...itemBase, ...(isSelected ? itemSelected : {}) }}
                onClick={() => {
                  const nextH12 = v;
                  const nextMer = autoFlipMerIfNeeded(h12, nextH12, mer);
                  setH12(nextH12);
                  if (nextMer !== mer) setMer(nextMer);
                  commit(nextMer, nextH12, min);
                  scrollToCenter(hourRef.current, idx, true); // 이 컬럼만 중앙
                }}
              >
                {pad2(v)}
              </div>
            );
          })}
          <div style={spacer} />
        </div>

        {/* 분 */}
        <div className="wtp-col" ref={minRef} style={colStyle}>
          <div style={spacer} />
          {minuteOptions.map((v, idx) => {
            const isSelected = v === min;
            return (
              <div
                key={v}
                style={{ ...itemBase, ...(isSelected ? itemSelected : {}) }}
                onClick={() => {
                  setMin(v);
                  commit(mer, h12, v);
                  scrollToCenter(minRef.current, idx, true); // 이 컬럼만 중앙
                }}
              >
                {pad2(v)}
              </div>
            );
          })}
          <div style={spacer} />
        </div>
      </div>
    );
  }
);

const Calendar: React.FC = () => {
  // 로그인 붙기 전 임시 유저
  const currentUserId = "userA";

  const [events, setEvents] = useState<CalEvent[]>([
    {
      id: "e1",
      title: "가족 모임",
      start: "2026-02-07T09:00",
      end: "2026-02-07T10:00",
      allDay: false,
      createdBy: "userA",
      color: "#3b82f6",
    },
  ]);

  const [mode, setMode] = useState<ModalMode>("none");
  const [picker, setPicker] = useState<PickerTarget>("none");

  const [form, setForm] = useState<FormState>({
    id: "",
    title: "",
    start: "",
    end: "",
    memo: "",
    repeat: "none",
    color: "#1e2a78",
    createdBy: "",
    allDay: false,
    prevStartTime: "09:00",
    prevEndTime: "10:00",
  });

  const calendarHeight = useMemo(() => "auto", []);

  const closeModal = () => {
    setPicker("none");
    setMode("none");
  };

  // start/end 역전 보정 규칙
  // - start 변경 후 start > end이면 end = start + 1h
  // - end 변경 후 end < start이면 start = end - 1h
  const ensureOrderAfterStartChange = (nextStart: Dayjs, currentEnd: Dayjs) => {
    if (nextStart.isAfter(currentEnd)) return { start: nextStart, end: addHours(nextStart, 1) };
    return { start: nextStart, end: currentEnd };
  };

  const ensureOrderAfterEndChange = (currentStart: Dayjs, nextEnd: Dayjs) => {
    if (nextEnd.isBefore(currentStart)) return { start: addHours(nextEnd, -1), end: nextEnd };
    return { start: currentStart, end: nextEnd };
  };

  // 날짜 1칸 클릭 → 생성(기본 09:00~10:00)
  const onDateClick = (info: any) => {
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
      color: "#1e2a78",
      createdBy: currentUserId,
      allDay: false,
      prevStartTime: "09:00",
      prevEndTime: "10:00",
    });

    setPicker("none");
    setMode("create");
  };

  // 이벤트 클릭 → 상세/수정 모달
  const onEventClick = (info: any) => {
    const e = info.event;
    const startD = toDayjs(e.startStr || "");
    const endD = toDayjs(e.endStr || e.startStr || "");

    setForm({
      id: e.id,
      title: e.title || "",
      start: formatISO(startD),
      end: formatISO(endD),
      memo: e.extendedProps?.memo || "",
      repeat: (e.extendedProps?.repeat as RepeatType) || "none",
      color: e.backgroundColor || "#1e2a78",
      createdBy: e.extendedProps?.createdBy || "",
      allDay: !!e.allDay,
      prevStartTime: startD.format("HH:mm"),
      prevEndTime: endD.format("HH:mm"),
    });

    setPicker("none");
    setMode("detail");
  };

  const canEdit = form.createdBy === currentUserId;

  const saveNew = () => {
    const t = form.title.trim();
    if (!t) return;

    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: t,
        start: form.start,
        end: form.end,
        allDay: form.allDay,
        memo: form.memo,
        repeat: form.repeat,
        color: form.color,
        createdBy: currentUserId,
      },
    ]);
    closeModal();
  };

  const updateEvent = () => {
    const t = form.title.trim();
    if (!t) return;

    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === form.id
          ? { ...ev, title: t, start: form.start, end: form.end, allDay: form.allDay, memo: form.memo, repeat: form.repeat, color: form.color }
          : ev
      )
    );
    closeModal();
  };

  const deleteEvent = () => {
    setEvents((prev) => prev.filter((ev) => ev.id !== form.id));
    closeModal();
  };

  const startD = toDayjs(form.start);
  const endD = toDayjs(form.end);

  // allDay 토글
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

        return { ...p, allDay: true, prevStartTime: backupStart, prevEndTime: backupEnd, start: formatISO(fixed.start), end: formatISO(fixed.end) };
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

  // 시작 날짜 변경
  const onPickStartDate = (d: Dayjs) => {
    setForm((p) => {
      const curStart = toDayjs(p.start);
      const curEnd = toDayjs(p.end);

      const nextStart = d.hour(curStart.hour()).minute(curStart.minute());
      const normalizedStart = p.allDay ? nextStart.hour(0).minute(0) : nextStart;
      const normalizedEnd = p.allDay ? curEnd.hour(23).minute(59) : curEnd;

      const fixed = ensureOrderAfterStartChange(normalizedStart, normalizedEnd);
      return { ...p, start: formatISO(fixed.start), end: formatISO(fixed.end) };
    });
  };

  // 종료 날짜 변경
  const onPickEndDate = (d: Dayjs) => {
    setForm((p) => {
      const curStart = toDayjs(p.start);
      const curEnd = toDayjs(p.end);

      const nextEnd = d.hour(curEnd.hour()).minute(curEnd.minute());
      const normalizedEnd = p.allDay ? nextEnd.hour(23).minute(59) : nextEnd;
      const normalizedStart = p.allDay ? curStart.hour(0).minute(0) : curStart;

      const fixed = ensureOrderAfterEndChange(normalizedStart, normalizedEnd);
      return { ...p, start: formatISO(fixed.start), end: formatISO(fixed.end) };
    });
  };

  // 시작 시간 변경
  const onPickStartTime = (t: Dayjs) => {
    setForm((p) => {
      const curStart = toDayjs(p.start);
      const curEnd = toDayjs(p.end);

      const nextStart = curStart.hour(t.hour()).minute(t.minute());
      const fixed = ensureOrderAfterStartChange(nextStart, curEnd);

      return {
        ...p,
        start: formatISO(p.allDay ? nextStart.hour(0).minute(0) : fixed.start),
        end: formatISO(p.allDay ? toDayjs(p.end).hour(23).minute(59) : fixed.end),
        prevStartTime: nextStart.format("HH:mm"),
      };
    });
  };

  // 종료 시간 변경
  const onPickEndTime = (t: Dayjs) => {
    setForm((p) => {
      const curStart = toDayjs(p.start);
      const curEnd = toDayjs(p.end);

      const nextEnd = curEnd.hour(t.hour()).minute(t.minute());
      const fixed = ensureOrderAfterEndChange(curStart, nextEnd);

      return {
        ...p,
        start: formatISO(p.allDay ? toDayjs(p.start).hour(0).minute(0) : fixed.start),
        end: formatISO(p.allDay ? nextEnd.hour(23).minute(59) : fixed.end),
        prevEndTime: nextEnd.format("HH:mm"),
      };
    });
  };

  // 모달 상단 텍스트 버튼
  const StartDateBtn = (
    <button type="button" onClick={() => setPicker((p) => (p === "startDate" ? "none" : "startDate"))} style={textPillBtnStyle(picker === "startDate")}>
      {formatKoreanDateLabel(startD)}
    </button>
  );

  const StartTimeBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "startTime" ? "none" : "startTime"))}
      style={{ ...textPillBtnStyle(picker === "startTime"), opacity: form.allDay ? 0.5 : 1, cursor: form.allDay ? "not-allowed" : "pointer" }}
      disabled={form.allDay}
    >
      {formatKoreanTimeLabel(startD)}
    </button>
  );

  const EndDateBtn = (
    <button type="button" onClick={() => setPicker((p) => (p === "endDate" ? "none" : "endDate"))} style={textPillBtnStyle(picker === "endDate")}>
      {formatKoreanDateLabel(endD)}
    </button>
  );

  const EndTimeBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "endTime" ? "none" : "endTime"))}
      style={{ ...textPillBtnStyle(picker === "endTime"), opacity: form.allDay ? 0.5 : 1, cursor: form.allDay ? "not-allowed" : "pointer" }}
      disabled={form.allDay}
    >
      {formatKoreanTimeLabel(endD)}
    </button>
  );

  const isTimeOpen = picker === "startTime" || picker === "endTime";
  const timeValue = picker === "startTime" ? startD : endD;

  return (
    <div style={{ width: "100%" }}>
      {/* ✅ FullCalendar 이벤트 “dot” 제거 + 블록 형태 통일 */}
      <style>{`
        /* 기본: 월뷰에서 이벤트를 블록처럼 보이게 */
        .fc .fc-daygrid-event {
          border-radius: 8px;
          padding: 2px 6px;
        }

        /* 혹시 남는 dot-event(점 형태)를 블록처럼 강제 */
        .fc .fc-daygrid-dot-event {
          border-radius: 8px;
          padding: 2px 6px;
          background: var(--fc-event-bg-color, rgba(30,42,120,0.2));
          border: 1px solid var(--fc-event-border-color, rgba(30,42,120,0.35));
        }
        .fc .fc-daygrid-dot-event .fc-daygrid-event-dot {
          display: none; /* 왼쪽 동그라미 제거 */
        }
        .fc .fc-daygrid-dot-event .fc-event-title,
        .fc .fc-daygrid-dot-event .fc-event-time {
          color: var(--fc-event-text-color, #fff);
          font-weight: 700;
        }
      `}</style>

      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height={calendarHeight}
          locale="ko"
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
          dateClick={onDateClick}
          eventClick={onEventClick}
          displayEventTime={false}
          displayEventEnd={false}
          /* ✅ 핵심: dayGridMonth에서 점(dot) 대신 블록 형태 우선 */
          eventDisplay="block"
          events={events.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            allDay: e.allDay,
            backgroundColor: e.color,
            borderColor: e.color,
            extendedProps: { memo: e.memo, repeat: e.repeat, createdBy: e.createdBy },
          }))}
          dayMaxEvents={2}
          moreLinkClick="popover"
        />
      </div>

      {/* ===== 모달 ===== */}
      {mode !== "none" && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              background: "#fff",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            {/* 헤더 */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{mode === "create" ? "일정 추가" : "일정 상세"}</div>

                {/* 하루종일 토글 */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>하루 종일</span>
                  <Switch checked={form.allDay} onChange={(e) => onToggleAllDay(e.target.checked)} inputProps={{ "aria-label": "all day" }} />
                </div>

                {/* 시작/종료 텍스트 버튼 */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 10, alignItems: "center" }}>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>시작</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {StartDateBtn}
                        {StartTimeBtn}
                      </div>
                    </div>

                    <div style={{ textAlign: "center", fontSize: 22, opacity: 0.35 }}>→</div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>종료</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {EndDateBtn}
                        {EndTimeBtn}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={closeModal}
                style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
                aria-label="close"
              >
                ✕
              </button>
            </div>

            {/* ===== 펼침 영역 ===== */}
            {picker !== "none" && (
              <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
                  {(picker === "startDate" || picker === "endDate") && (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 10 }}>{picker === "startDate" ? "시작 날짜 선택" : "종료 날짜 선택"}</div>
                      <DateCalendar
                        value={picker === "startDate" ? startD : endD}
                        onChange={(d) => {
                          if (!d) return;
                          if (picker === "startDate") onPickStartDate(d);
                          else onPickEndDate(d);
                        }}
                      />
                    </div>
                  )}

                  {isTimeOpen && (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 10 }}>{picker === "startTime" ? "시작 시간 선택" : "종료 시간 선택"}</div>

                      <div style={{ opacity: form.allDay ? 0.5 : 1, pointerEvents: form.allDay ? "none" : "auto" }}>
                        <WheelTimePicker
                          value={timeValue}
                          minutesStep={5}
                          onChange={(t) => {
                            if (picker === "startTime") onPickStartTime(t);
                            else onPickEndTime(t);
                          }}
                        />
                      </div>

                      {form.allDay && (
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>* 하루 종일이 켜져있어서 시간 변경은 비활성화됩니다.</div>
                      )}
                    </div>
                  )}
                </LocalizationProvider>
              </div>
            )}

            {/* 제목 */}
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.8 }}>제목</label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="예: 생일, 여행, 병원"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", outline: "none" }}
                autoFocus
              />
            </div>

            {/* 메모 */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.8 }}>메모</label>
              <textarea
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                rows={3}
                placeholder="한두 줄 메모"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", outline: "none", resize: "vertical" }}
              />
            </div>

            {/* 반복 */}
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 13, opacity: 0.8, width: 60 }}>반복</label>
              <select
                value={form.repeat}
                onChange={(e) => setForm((p) => ({ ...p, repeat: e.target.value as RepeatType }))}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", outline: "none" }}
              >
                <option value="none">반복 안함</option>
                <option value="daily">매일</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월</option>
                <option value="yearly">매년</option>
              </select>
            </div>

            {/* 색상 */}
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 13, opacity: 0.8, width: 60 }}>색상</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                style={{ width: 48, height: 36, padding: 0, border: "none", background: "transparent" }}
              />
              <div style={{ fontSize: 12, opacity: 0.7 }}>내 고유색(추후 프로필로 이동)</div>
            </div>

            {/* 버튼 */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                onClick={closeModal}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", background: "#fff", cursor: "pointer" }}
              >
                취소
              </button>

              {mode === "create" ? (
                <button
                  onClick={saveNew}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "none", background: "#1e2a78", color: "#fff", cursor: "pointer" }}
                >
                  저장
                </button>
              ) : (
                <>
                  <button
                    onClick={deleteEvent}
                    disabled={!canEdit}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(220,38,38,0.4)",
                      background: canEdit ? "#fff" : "rgba(0,0,0,0.05)",
                      color: canEdit ? "#dc2626" : "rgba(0,0,0,0.35)",
                      cursor: canEdit ? "pointer" : "not-allowed",
                    }}
                  >
                    삭제
                  </button>
                  <button
                    onClick={updateEvent}
                    disabled={!canEdit}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "none",
                      background: canEdit ? "#1e2a78" : "rgba(0,0,0,0.2)",
                      color: "#fff",
                      cursor: canEdit ? "pointer" : "not-allowed",
                    }}
                  >
                    수정
                  </button>
                </>
              )}
            </div>

            {!canEdit && mode === "detail" && (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>* 다른 사람이 만든 일정은 수정/삭제할 수 없습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
