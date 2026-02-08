// EventModal.tsx (완성본: 반복 ↔ 다중날짜 상호배제 UI/로직 포함)
import React, { useMemo } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";

import Switch from "@mui/material/Switch";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";

import type { ApplyScope, FormState, ModalMode, PickerTarget, RepeatType } from "../types";
import { CustomDay } from "./CustomDay";
import { WheelTimePicker } from "./WheelTimePicker";
import {
  formatKoreanDateLabel,
  formatKoreanTimeLabel,
  textPillBtnStyle,
  toDayjs,
} from "../utils/date";

type Props = {
  mode: ModalMode;

  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;

  formError: string;
  setFormError: (s: string) => void;

  holidaySet: Set<string>;

  picker: PickerTarget;
  setPicker: (p: PickerTarget | ((prev: PickerTarget) => PickerTarget)) => void;

  lockRepeatControls: boolean;
  canEdit: boolean;

  onToggleAllDay: (checked: boolean) => void;

  onPickStartDate: (d: Dayjs) => void;
  onPickEndDate: (d: Dayjs) => void;
  onPickStartTime: (t: Dayjs) => void;
  onPickEndTime: (t: Dayjs) => void;
  onPickRepeatStartDate: (d: Dayjs) => void;
  onPickRepeatEndDate: (d: Dayjs) => void;

  toggleMultiDate: (ymd: string) => void;
  clearMultiDates: () => void;

  closeModal: () => void;
  saveNew: () => void;
  updateEvent: () => void;
  deleteEvent: () => void;

  getDayType: (d: Dayjs) => "red" | "blue" | "black";
};

export function EventModal(props: Props) {
  const {
    mode,
    form,
    setForm,
    formError,
    setFormError,
    holidaySet,
    picker,
    setPicker,
    lockRepeatControls,
    canEdit,
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
    getDayType,
  } = props;

  const startD = toDayjs(form.start);
  const endD = toDayjs(form.end);

  const multiDatesSet = useMemo(() => new Set(form.multiDates ?? []), [form.multiDates]);

  // ✅ 상호배제 규칙
  // - 반복이 켜져 있으면 다중 날짜 선택 금지
  const disableMultiDates = form.repeat !== "none";
  // - (생성 모드에서) 다중 날짜가 2개 이상이면 반복 선택 금지
  const isMultiDateMode = mode === "create" && (form.multiDates?.length ?? 0) >= 2;

  const dateTextColor = (d: Dayjs) => {
    const t = getDayType(d);
    if (t === "red") return "#dc2626";
    if (t === "blue") return "#2563eb";
    return "rgba(0,0,0,0.90)";
  };

  const StartDateBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "startDate" ? "none" : "startDate"))}
      style={{ ...textPillBtnStyle(picker === "startDate"), color: dateTextColor(startD) }}
    >
      {formatKoreanDateLabel(startD)}
    </button>
  );

  const StartTimeBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "startTime" ? "none" : "startTime"))}
      style={{
        ...textPillBtnStyle(picker === "startTime"),
        opacity: form.allDay ? 0.5 : 1,
        cursor: form.allDay ? "not-allowed" : "pointer",
      }}
      disabled={form.allDay}
    >
      {formatKoreanTimeLabel(startD)}
    </button>
  );

  const EndDateBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "endDate" ? "none" : "endDate"))}
      style={{ ...textPillBtnStyle(picker === "endDate"), color: dateTextColor(endD) }}
    >
      {formatKoreanDateLabel(endD)}
    </button>
  );

  const EndTimeBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "endTime" ? "none" : "endTime"))}
      style={{
        ...textPillBtnStyle(picker === "endTime"),
        opacity: form.allDay ? 0.5 : 1,
        cursor: form.allDay ? "not-allowed" : "pointer",
      }}
      disabled={form.allDay}
    >
      {formatKoreanTimeLabel(endD)}
    </button>
  );

  const isTimeOpen = picker === "startTime" || picker === "endTime";
  const timeValue = picker === "startTime" ? startD : endD;

  const RepeatUnitLabel =
    form.repeat === "none"
      ? ""
      : form.repeat === "daily"
      ? "일마다"
      : form.repeat === "weekly"
      ? "주마다"
      : form.repeat === "monthly"
      ? "개월마다"
      : "년마다";

  const repeatUiDisabled = form.repeat === "none" || lockRepeatControls;

  // ✅ repeat 변경 핸들러: 반복 켜면 multiDates는 시작일 1개로 강제
  const onChangeRepeat = (next: RepeatType) => {
    setFormError("");
    setForm((p) => {
      const nextRepeat = next;
      const startYmd = String(p.start || "").slice(0, 10);
      const startYmdOk = /^\d{4}-\d{2}-\d{2}$/.test(startYmd);

      // 다중 날짜 상태에서 반복을 켜는 것을 UI에서 막지만, 혹시라도 들어오면 방어
      if (nextRepeat !== "none" && (p.multiDates?.length ?? 0) >= 2) {
        // repeat은 변경하지 않고 그대로 유지
        return p;
      }

      return {
        ...p,
        repeat: nextRepeat,
        repeatInterval: Math.max(1, p.repeatInterval || 1),
        // ✅ 반복을 켜면 다중날짜는 시작일만 유지
        multiDates: nextRepeat === "none" ? p.multiDates : startYmdOk ? [startYmd] : [],
      };
    });
  };

  // ✅ 다중날짜 달력 열기: 반복이 켜져 있으면 열지 않음
  const openMultiDatesPicker = () => {
    if (disableMultiDates) {
      setFormError("반복 일정에서는 ‘여러 날짜 선택’을 사용할 수 없습니다.");
      return;
    }
    setPicker((p) => (p === "multiDates" ? "none" : "multiDates"));
  };

  return (
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
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {mode === "create" ? "일정 추가" : "일정 상세"}
            </div>

            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>하루 종일</span>
              <Switch
                checked={form.allDay}
                onChange={(e) => onToggleAllDay(e.target.checked)}
                inputProps={{ "aria-label": "all day" }}
              />
            </div>

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

            {formError && (
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#dc2626" }}>
                {formError}
              </div>
            )}
          </div>

          <button
            onClick={closeModal}
            style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
            aria-label="close"
          >
            ✕
          </button>
        </div>

        {/* 제목 */}
        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.8 }}>제목</label>
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
          <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.8 }}>메모</label>
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
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: lockRepeatControls ? 0.55 : 1 }}>
            <label style={{ fontSize: 13, opacity: 0.8, width: 60 }}>반복</label>

            <select
              value={form.repeat}
              disabled={lockRepeatControls || isMultiDateMode}
              onChange={(e) => onChangeRepeat(e.target.value as RepeatType)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
                cursor: lockRepeatControls || isMultiDateMode ? "not-allowed" : "pointer",
              }}
            >
              <option value="none">반복 안함</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
            </select>

            <input
              type="number"
              min={1}
              value={form.repeatInterval}
              disabled={repeatUiDisabled}
              onChange={(e) => setForm((p) => ({ ...p, repeatInterval: Math.max(1, Number(e.target.value || 1)) }))}
              style={{
                width: 86,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
                opacity: repeatUiDisabled ? 0.5 : 1,
                cursor: repeatUiDisabled ? "not-allowed" : "text",
              }}
            />

            <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap" }}>{RepeatUnitLabel}</div>
          </div>

          {form.repeat !== "none" && (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                opacity: repeatUiDisabled ? 0.55 : 1,
                pointerEvents: repeatUiDisabled ? "none" : "auto",
              }}
            >
              <div style={{ fontSize: 13, opacity: 0.8, width: 60 }}>기간</div>

              <button
                type="button"
                onClick={() => setPicker((p) => (p === "repeatStartDate" ? "none" : "repeatStartDate"))}
                style={textPillBtnStyle(picker === "repeatStartDate")}
              >
                {form.repeatRangeStart ? dayjs(form.repeatRangeStart).format("M월 D일") : "시작일(없음)"}
              </button>

              <span style={{ opacity: 0.5 }}>~</span>

              <button
                type="button"
                onClick={() => setPicker((p) => (p === "repeatEndDate" ? "none" : "repeatEndDate"))}
                style={textPillBtnStyle(picker === "repeatEndDate")}
              >
                {form.repeatRangeEnd ? dayjs(form.repeatRangeEnd).format("M월 D일") : "종료일(없음)"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormError("");
                  setForm((p) => ({ ...p, repeatRangeStart: "", repeatRangeEnd: "" }));
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                초기화
              </button>
            </div>
          )}

          {lockRepeatControls && (
            <div style={{ fontSize: 12, opacity: 0.7, color: "#111827" }}>
              * “이 일정만”에서는 반복 규칙을 변경할 수 없습니다. (전체/이후에서 변경 가능)
            </div>
          )}
          {isMultiDateMode && (
            <div style={{ fontSize: 12, opacity: 0.7, color: "#111827" }}>
              * 여러 날짜에 동일 일정 추가에서는 반복 설정을 사용할 수 없습니다. (단건 날짜일 때만 가능)
            </div>
          )}
          {/* ✅ 반복이면 다중 날짜 안내 */}
          {mode === "create" && disableMultiDates && (
            <div style={{ fontSize: 12, opacity: 0.7, color: "#111827" }}>
              * 반복 일정에서는 “여러 날짜에 동일 일정 추가”를 사용할 수 없습니다.
            </div>
          )}
        </div>

        {/* 불규칙 날짜 여러 개 */}
        {mode === "create" && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>여러 날짜에 동일 일정 추가</div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={openMultiDatesPicker}
                  disabled={disableMultiDates}
                  style={{
                    ...textPillBtnStyle(picker === "multiDates"),
                    opacity: disableMultiDates ? 0.5 : 1,
                    cursor: disableMultiDates ? "not-allowed" : "pointer",
                  }}
                >
                  날짜 선택
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (disableMultiDates) {
                      setFormError("반복 일정에서는 ‘여러 날짜 선택’을 사용할 수 없습니다.");
                      return;
                    }
                    clearMultiDates();
                  }}
                  disabled={disableMultiDates}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 12,
                    opacity: disableMultiDates ? 0.35 : 0.7,
                    cursor: disableMultiDates ? "not-allowed" : "pointer",
                  }}
                >
                  초기화
                </button>
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              선택된 날짜: {(form.multiDates?.length ?? 0) > 0 ? form.multiDates.join(", ") : "없음"}
            </div>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
              * 저장을 누르면 선택된 날짜 각각에 동일한 일정이 생성됩니다.
            </div>

            {disableMultiDates && (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
                * 현재는 반복 일정이라 다중 날짜 선택이 비활성화됩니다.
              </div>
            )}
          </div>
        )}

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

        {/* 적용 범위 */}
        {mode === "detail" && (form.repeatSnap.repeat ?? "none") !== "none" && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>적용 범위</div>

            {(
              [
                { v: "this", label: "이 일정만" },
                { v: "following", label: "이 일정과 이후" },
                { v: "all", label: "전체 일정(모두)" },
              ] as const
            ).map((opt) => (
              <label key={opt.v} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <input
                  type="radio"
                  name="applyScope"
                  value={opt.v}
                  checked={form.applyScope === opt.v}
                  onChange={() => {
                    setFormError("");
                    setForm((p) => {
                      if (opt.v === "this") {
                        return {
                          ...p,
                          applyScope: opt.v,
                          repeat: p.repeatSnap.repeat,
                          repeatInterval: p.repeatSnap.repeatInterval,
                          repeatRangeStart: p.repeatSnap.repeatRangeStart,
                          repeatRangeEnd: p.repeatSnap.repeatRangeEnd,
                        };
                      }
                      return { ...p, applyScope: opt.v as ApplyScope };
                    });
                  }}
                />
                <span style={{ fontSize: 13, opacity: 0.85 }}>{opt.label}</span>
              </label>
            ))}

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
              * “이 일정과 이후”는 과거 일정이 유지됩니다.
            </div>
          </div>
        )}

        {/* 펼침 영역 */}
        {picker !== "none" && (
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
              {(picker === "startDate" ||
                picker === "endDate" ||
                picker === "repeatStartDate" ||
                picker === "repeatEndDate" ||
                picker === "multiDates") && (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    {picker === "startDate"
                      ? "시작 날짜 선택"
                      : picker === "endDate"
                      ? "종료 날짜 선택"
                      : picker === "repeatStartDate"
                      ? "반복 시작일 선택"
                      : picker === "repeatEndDate"
                      ? "반복 종료일 선택"
                      : "여러 날짜 선택"}
                  </div>

                  {/* ✅ 반복 상태에서 multiDates 달력이 열렸다면 즉시 안내(방어) */}
                  {picker === "multiDates" && disableMultiDates ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      반복 일정에서는 여러 날짜를 선택할 수 없습니다. (반복을 끄면 사용 가능)
                    </div>
                  ) : (
                    <DateCalendar
                      value={
                        picker === "startDate"
                          ? startD
                          : picker === "endDate"
                          ? endD
                          : picker === "repeatStartDate"
                          ? form.repeatRangeStart
                            ? dayjs(`${form.repeatRangeStart}T00:00`)
                            : startD
                          : picker === "repeatEndDate"
                          ? form.repeatRangeEnd
                            ? dayjs(`${form.repeatRangeEnd}T00:00`)
                            : endD
                          : form.multiDates?.[form.multiDates.length - 1]
                          ? dayjs(`${form.multiDates[form.multiDates.length - 1]}T00:00`)
                          : startD
                      }
                      onChange={(d) => {
                        if (!d) return;
                        if (picker === "startDate") onPickStartDate(d);
                        else if (picker === "endDate") onPickEndDate(d);
                        else if (picker === "repeatStartDate") onPickRepeatStartDate(d);
                        else if (picker === "repeatEndDate") onPickRepeatEndDate(d);
                        else if (picker === "multiDates") {
                          // ✅ 이중 방어
                          if (disableMultiDates) {
                            setFormError("반복 일정에서는 ‘여러 날짜 선택’을 사용할 수 없습니다.");
                            return;
                          }
                          toggleMultiDate(d.format("YYYY-MM-DD"));
                        }
                      }}
                      slots={{ day: CustomDay as any }}
                      slotProps={{
                        day: {
                          holidaySet,
                          selectedSet: picker === "multiDates" ? multiDatesSet : undefined,
                        } as any,
                      }}
                      sx={{
                        "& .MuiDayCalendar-weekDayLabel:first-of-type": { color: "#dc2626" },
                        "& .MuiDayCalendar-weekDayLabel:last-of-type": { color: "#2563eb" },
                      }}
                    />
                  )}
                </div>
              )}

              {isTimeOpen && (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    {picker === "startTime" ? "시작 시간 선택" : "종료 시간 선택"}
                  </div>

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
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
                      * 하루 종일이 켜져있어서 시간 변경은 비활성화됩니다.
                    </div>
                  )}
                </div>
              )}
            </LocalizationProvider>
          </div>
        )}

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
  );
}
