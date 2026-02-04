import React, { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

type RepeatType = "none" | "daily" | "weekly" | "monthly" | "yearly";

type CalEvent = {
  id: string;
  title: string;
  start: string;          // ISO
  end?: string;           // ISO (범위일정)
  allDay: boolean;
  memo?: string;
  repeat?: RepeatType;
  color?: string;
  createdBy: string;      // 권한 체크용
};

const Calendar: React.FC = () => {
  // 로그인 붙기 전 임시 유저
  const currentUserId = "userA";

  // YYYY-MM-DD or YYYY-MM-DDTHH:mm(:ss) -> {date, time}
  const splitDateTime = (v: string) => {
  if (!v) return { date: "", time: "" };
      const [date, timeFull] = v.split("T");
      const time = (timeFull || "").slice(0, 5); // HH:mm
      return { date: date || "", time: time || "" };
  };

  // {date, time} -> YYYY-MM-DDTHH:mm (둘 다 있으면), 아니면 date만
  const joinDateTime = (date: string, time: string) => {
      if (!date) return "";
      if (!time) return date; // 시간 없으면 allDay처럼 date만
      return `${date}T${time}`;
  };

  // 빈값이면 기본 시간 제공(UX용)
  const safeTime = (t: string, fallback: string) => (t && t.length >= 5 ? t : fallback);

  const [events, setEvents] = useState<CalEvent[]>([
    {
      id: "e1",
      title: "가족 모임",
      start: "2026-02-07",
      allDay: true,
      createdBy: "userA",
      color: "#3b82f6",
    },
  ]);

  // 모달 상태: create / detail
  const [mode, setMode] = useState<"none" | "create" | "detail">("none");

  // 폼 상태
  const [form, setForm] = useState({
    id: "",
    title: "",
    start: "",
    end: "",
    memo: "",
    repeat: "none" as RepeatType,
    color: "#1e2a78",
    createdBy: "",
  });

  const calendarHeight = useMemo(() => "auto", []);

  // ✅ 날짜 1칸 클릭 → 생성(하루 일정)
  const onDateClick = (info: any) => {
    setForm({
      id: "",
      title: "",
      start: `${info.dateStr}T09:00`,
      end: `${info.dateStr}T10:00`,
      memo: "",
      repeat: "none",
      color: "#1e2a78",
      createdBy: currentUserId,
    });
    setMode("create");
  };


  // 이벤트 클릭 → 상세/수정 모달
  const onEventClick = (info: any) => {
    const e = info.event;
    setForm({
      id: e.id,
      title: e.title || "",
      start: e.startStr || "",
      end: e.endStr || e.startStr || "",
      memo: e.extendedProps?.memo || "",
      repeat: (e.extendedProps?.repeat as RepeatType) || "none",
      color: e.backgroundColor || "#1e2a78",
      createdBy: e.extendedProps?.createdBy || "",
    });
    setMode("detail");
  };

  const closeModal = () => setMode("none");

  const saveNew = () => {
    const t = form.title.trim();
    if (!t) return;
    if (form.end && form.start && form.end < form.start) return;
    
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: t,
        start: form.start,
        end: form.end,
        allDay: false,
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
          ? {
              ...ev,
              title: t,
              start: form.start,
              end: form.end,
              memo: form.memo,
              repeat: form.repeat,
              color: form.color,
            }
          : ev
      )
    );

    closeModal();
  };

  const deleteEvent = () => {
    setEvents((prev) => prev.filter((ev) => ev.id !== form.id));
    closeModal();
  };

  const canEdit = form.createdBy === currentUserId;

  return (
    <div style={{ width: "100%" }}>
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
        headerToolbar={{
            left: "prev,next today",
            center: "title",   // 월/연도 타이틀 표시
            right: "",
        }}
        dateClick={onDateClick} // 하루 클릭 → 생성 모달
        eventClick={onEventClick} // 이벤트 클릭 → 상세 모달
        events={events.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            allDay: e.allDay,
            backgroundColor: e.color,
            borderColor: e.color,
            extendedProps: {
            memo: e.memo,
            repeat: e.repeat,
            createdBy: e.createdBy,
            },
        }))}
        dayMaxEvents={2}
        moreLinkClick="popover"
        />
      </div>

      {/* 모달 공통 */}
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
              width: "min(520px, 100%)",
              background: "#fff",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {mode === "create" ? "일정 추가" : "일정 상세"}
                </div>
                {(() => {
                  const s = splitDateTime(form.start);
                  const e = splitDateTime(form.end);
                
                  return (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {/* 시작 */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ width: 44, fontSize: 12, opacity: 0.7 }}>시작</span>
                        <input
                          type="date"
                          value={s.date}
                          onChange={(ev) => {
                            const nextDate = ev.target.value;
                            const next = joinDateTime(nextDate, safeTime(s.time, "09:00"));
                            setForm((p) => ({ ...p, start: next }));
                          }}
                        />
                        <input
                          type="time"
                          value={safeTime(s.time, "09:00")}
                          onChange={(ev) => {
                            const nextTime = ev.target.value;
                            const baseDate = s.date || splitDateTime(form.start).date; // date만
                            const next = joinDateTime(baseDate, nextTime);
                            setForm((p) => ({ ...p, start: next }));
                          }}
                        />
                      </div>
                
                      {/* 종료 */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ width: 44, fontSize: 12, opacity: 0.7 }}>종료</span>
                        <input
                          type="date"
                          value={e.date}
                          onChange={(ev) => {
                            const nextTime = ev.target.value;
                            const baseDate = e.date || splitDateTime(form.end).date; // date만
                            const next = joinDateTime(baseDate, nextTime);
                            setForm((p) => ({ ...p, end: next }));
                          }}
                        />
                        <input
                          type="time"
                          value={safeTime(e.time, "10:00")}
                          onChange={(ev) => {
                            const nextTime = ev.target.value;
                            const next = joinDateTime(e.date || form.end, nextTime);
                            setForm((p) => ({ ...p, end: next }));
                          }}
                        />
                      </div>
                
                      <div style={{ fontSize: 12, opacity: 0.6 }}>
                        * 날짜/시간은 여기서 변경할 수 있습니다.
                      </div>
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={closeModal}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                aria-label="close"
              >
                ✕
              </button>
            </div>

            {/* 제목 */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.8 }}>
                제목
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="예: 생일, 여행, 병원"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  outline: "none",
                }}
                autoFocus
              />
            </div>

            {/* 메모 */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.8 }}>
                메모
              </label>
              <textarea
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                rows={3}
                placeholder="한두 줄 메모"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            {/* 반복 */}
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 13, opacity: 0.8, width: 60 }}>반복</label>
              <select
                value={form.repeat}
                onChange={(e) => setForm((p) => ({ ...p, repeat: e.target.value as RepeatType }))}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  outline: "none",
                }}
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
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                취소
              </button>

              {mode === "create" ? (
                <button
                  onClick={saveNew}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "#1e2a78",
                    color: "#fff",
                    cursor: "pointer",
                  }}
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
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
                * 다른 사람이 만든 일정은 수정/삭제할 수 없습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
