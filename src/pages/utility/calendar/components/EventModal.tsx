// EventModal.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";

import Switch from "@mui/material/Switch";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";

import type { ApplyScope, FormState, ModalMode, PickerTarget, RepeatType } from "../types";
import { CustomDay } from "./CustomDay";
import { WheelTimePicker } from "./WheelTimePicker";
import { formatKoreanDateLabel, formatKoreanTimeLabel, toDayjs } from "../utils/date";

import styles from "./EventModal.module.css";

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

  const isRecurring =
    (form.repeat ?? "none") !== "none" || (form.repeatSnap?.repeat ?? "none") !== "none";
  const disableMultiDates = isRecurring;

  const isMultiDateMode = (form.multiDates?.length ?? 0) >= 2;
  const blockRepeatBecauseMultiDates = isMultiDateMode;

  const RepeatUnitLabel =
    form.repeat === "none"
      ? ""
      : form.repeat === "daily"
      ? "일마다　"
      : form.repeat === "weekly"
      ? "주마다　"
      : form.repeat === "monthly"
      ? "개월마다"
      : "년마다　";

  const repeatUiDisabled = form.repeat === "none" || lockRepeatControls;

  const dateTextColor = (d: Dayjs) => {
    const t = getDayType(d);
    if (t === "red") return "#dc2626";
    if (t === "blue") return "#2563eb";
    return "rgba(0,0,0,0.90)";
  };

  const pillClass = (active: boolean, disabled?: boolean) =>
    [styles.pillBtn, active ? styles.pillBtnActive : "", disabled ? styles.pillBtnDisabled : ""]
      .filter(Boolean)
      .join(" ");

  const [repeatOpen, setRepeatOpen] = useState(false);
  const [multiDateOpen, setMultiDateOpen] = useState(false);

  useEffect(() => {
    if (picker === "repeatStartDate" || picker === "repeatEndDate") {
      setRepeatOpen(true);
    }
    if (picker === "multiDates") {
      setMultiDateOpen(true);
    }
  }, [picker]);

  const repeatSummary =
    form.repeat === "none"
      ? "반복 안함"
      : `${
          form.repeat === "daily"
            ? `매일 / ${Math.max(1, form.repeatInterval || 1)}일 간격`
            : form.repeat === "weekly"
            ? `매주 / ${Math.max(1, form.repeatInterval || 1)}주 간격`
            : form.repeat === "monthly"
            ? `매월 / ${Math.max(1, form.repeatInterval || 1)}개월 간격`
            : `매년 / ${Math.max(1, form.repeatInterval || 1)}년 간격`
        }`;

  const multiDateSummary =
    (form.multiDates?.length ?? 0) > 0
      ? `${form.multiDates?.length ?? 0}개 날짜 선택됨`
      : "선택된 날짜 없음";

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement | null>(null);

  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const clampDragOffset = (nextX: number, nextY: number) => {
    const el = modalRef.current;
    if (!el) return { x: nextX, y: nextY };

    const rect = el.getBoundingClientRect();
    const modalWidth = rect.width;
    const modalHeight = rect.height;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const baseLeft = (vw - modalWidth) / 2;
    const baseTop = (vh - modalHeight) / 2;

    const minX = -baseLeft;
    const maxX = vw - modalWidth - baseLeft;

    const minY = -baseTop;
    const maxY = vh - modalHeight - baseTop;

    return {
      x: Math.min(Math.max(nextX, minX), maxX),
      y: Math.min(Math.max(nextY, minY), maxY),
    };
  };

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    if (
      target.closest("button, input, textarea, select, option, label") ||
      target.closest(".MuiSwitch-root")
    ) {
      return;
    }

    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: dragOffset.x,
      originY: dragOffset.y,
    };

    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;

      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      const nextX = dragRef.current.originX + dx;
      const nextY = dragRef.current.originY + dy;

      setDragOffset(clampDragOffset(nextX, nextY));
    };

    const handleMouseUp = () => {
      dragRef.current.dragging = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragOffset.x, dragOffset.y]);

  useLayoutEffect(() => {
    const handleResize = () => {
      setDragOffset((prev) => clampDragOffset(prev.x, prev.y));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const onChangeRepeat = (next: RepeatType) => {
    setFormError("");

    if (next === "none" && (picker === "repeatStartDate" || picker === "repeatEndDate")) {
      setPicker("none");
    }

    setForm((p) => {
      const nextRepeat = next;
      const startYmd = String(p.start || "").slice(0, 10);
      const startYmdOk = /^\d{4}-\d{2}-\d{2}$/.test(startYmd);

      if (nextRepeat !== "none" && (p.multiDates?.length ?? 0) >= 2) return p;

      return {
        ...p,
        repeat: nextRepeat,
        repeatInterval: Math.max(1, p.repeatInterval || 1),
        multiDates: nextRepeat === "none" ? p.multiDates : startYmdOk ? [startYmd] : [],
      };
    });
  };

  const openMultiDatesPicker = () => {
    if (disableMultiDates) {
      setFormError("반복 일정에서는 ‘여러 날짜 선택’을 사용할 수 없습니다.");
      return;
    }
    setMultiDateOpen(true);
    setPicker((p) => (p === "multiDates" ? "none" : "multiDates"));
  };

  const isDetailCloneMode =
    mode === "detail" && (form.multiDates?.length ?? 0) > 0 && !disableMultiDates;

  const StartDateBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "startDate" ? "none" : "startDate"))}
      className={pillClass(picker === "startDate")}
      style={{ color: dateTextColor(startD) }}
    >
      {formatKoreanDateLabel(startD)}
    </button>
  );

  const StartTimeBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "startTime" ? "none" : "startTime"))}
      className={pillClass(picker === "startTime", form.allDay)}
      disabled={form.allDay}
    >
      {formatKoreanTimeLabel(startD)}
    </button>
  );

  const EndDateBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "endDate" ? "none" : "endDate"))}
      className={pillClass(picker === "endDate")}
      style={{ color: dateTextColor(endD) }}
    >
      {formatKoreanDateLabel(endD)}
    </button>
  );

  const EndTimeBtn = (
    <button
      type="button"
      onClick={() => setPicker((p) => (p === "endTime" ? "none" : "endTime"))}
      className={pillClass(picker === "endTime", form.allDay)}
      disabled={form.allDay}
    >
      {formatKoreanTimeLabel(endD)}
    </button>
  );

  return (
    <div className={styles.overlay}>
      <div
        ref={modalRef}
        className={styles.modal}
        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
      >
        <button onClick={closeModal} className={styles.closeBtn} aria-label="close">
          ✕
        </button>

        <div className={styles.header} onMouseDown={handleDragStart}>
          <div className={styles.headerLeft}>
            <div className={styles.title}>{mode === "create" ? "일정 추가" : "일정 상세"}</div>

            <div className={styles.allDayRow}>
              <span className={styles.allDayLabel}>하루 종일</span>
              <Switch
                checked={form.allDay}
                onChange={(e) => onToggleAllDay(e.target.checked)}
                inputProps={{ "aria-label": "all day" }}
              />
            </div>

            <div className={styles.rangeWrap}>
              <div className={styles.rangeGrid}>
                <div className={styles.rangeCol}>
                  <div className={styles.rangeHint}>시작</div>
                  <div className={styles.pillRow}>
                    {StartDateBtn}
                    {StartTimeBtn}
                  </div>
                </div>

                <div className={styles.rangeArrow}>→</div>

                <div className={styles.rangeCol}>
                  <div className={styles.rangeHint}>종료</div>
                  <div className={styles.pillRow}>
                    {EndDateBtn}
                    {EndTimeBtn}
                  </div>
                </div>
              </div>

              {(picker === "startDate" ||
                picker === "startTime" ||
                picker === "endDate" ||
                picker === "endTime") && (
                <div className={styles.expandInline}>
                  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
                    {(picker === "startDate" || picker === "endDate") && (
                      <div>
                        <div className={styles.expandTitle}>
                          {picker === "startDate" ? "시작 날짜 선택" : "종료 날짜 선택"}
                        </div>

                        <DateCalendar
                          value={picker === "startDate" ? startD : endD}
                          onChange={(d) => {
                            if (!d) return;
                            if (picker === "startDate") onPickStartDate(d);
                            else onPickEndDate(d);
                          }}
                          slots={{ day: CustomDay as any }}
                          slotProps={{
                            day: {
                              holidaySet,
                            } as any,
                          }}
                          sx={{
                            "& .MuiDayCalendar-weekDayLabel:first-of-type": { color: "#dc2626" },
                            "& .MuiDayCalendar-weekDayLabel:last-of-type": { color: "#2563eb" },

                            "& .MuiYearCalendar-button": {
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              lineHeight: 1,
                              paddingTop: 0,
                              paddingBottom: 0,
                            },
                          }}
                        />
                      </div>
                    )}

                    {(picker === "startTime" || picker === "endTime") && (
                      <div>
                        <div className={styles.expandTitle}>
                          {picker === "startTime" ? "시작 시간 선택" : "종료 시간 선택"}
                        </div>

                        <div className={form.allDay ? styles.timeDisabled : ""}>
                          <WheelTimePicker
                            value={picker === "startTime" ? startD : endD}
                            minutesStep={5}
                            onChange={(t) => {
                              if (picker === "startTime") onPickStartTime(t);
                              else onPickEndTime(t);
                            }}
                          />
                        </div>

                        {form.allDay && (
                          <div className={styles.expandHint}>
                            * 하루 종일이 켜져있어서 시간 변경은 비활성화됩니다.
                          </div>
                        )}
                      </div>
                    )}
                  </LocalizationProvider>
                </div>
              )}
            </div>

            {formError && <div className={styles.formError}>{formError}</div>}
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>제목</label>
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="일정을 입력해주세요."
            className={styles.textInput}
            autoFocus
          />
        </div>

        <div className={styles.section}>
          <label className={styles.label}>메모</label>
          <textarea
            value={form.memo}
            onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
            rows={3}
            placeholder="일정과 관련한 상세 내용을 기재해주세요."
            className={styles.textarea}
          />
        </div>

        <>
          <div
            className={styles.sectionRow}
            onClick={() => {
              const next = !repeatOpen;
              setRepeatOpen(next);

              if (!next && (picker === "repeatStartDate" || picker === "repeatEndDate")) {
                setPicker("none");
              }
            }}
          >
            <div className={styles.sectionTitle}>반복</div>

            <div className={styles.sectionRight}>
              <span className={styles.sectionSummary}>{repeatSummary}</span>
              <span className={styles.sectionArrow}>{repeatOpen ? "▴" : "▾"}</span>
            </div>
          </div>

          {repeatOpen && (
            <div className={styles.sectionGrid}>
              <div className={[styles.repeatRow, lockRepeatControls ? styles.dim : ""].join(" ")}>
                <select
                  value={form.repeat}
                  disabled={lockRepeatControls || blockRepeatBecauseMultiDates}
                  onChange={(e) => onChangeRepeat(e.target.value as RepeatType)}
                  className={[
                    styles.select,
                    lockRepeatControls || blockRepeatBecauseMultiDates ? styles.disabledControl : "",
                  ].join(" ")}
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
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      repeatInterval: Math.max(1, Number(e.target.value || 1)),
                    }))
                  }
                  className={[
                    styles.numberInput,
                    repeatUiDisabled ? styles.disabledControl : "",
                  ].join(" ")}
                />

                <div className={styles.repeatUnit}>{RepeatUnitLabel}</div>
              </div>

              {form.repeat !== "none" && (
                <div
                  className={[styles.periodRow, repeatUiDisabled ? styles.periodDisabled : ""].join(
                    " "
                  )}
                >
                  <div className={styles.labelFixed}>기간</div>

                  <button
                    type="button"
                    onClick={() =>
                      setPicker((p) => (p === "repeatStartDate" ? "none" : "repeatStartDate"))
                    }
                    className={pillClass(picker === "repeatStartDate")}
                  >
                    {form.repeatRangeStart
                      ? dayjs(form.repeatRangeStart).format("M월 D일")
                      : "시작일(없음)"}
                  </button>

                  <span className={styles.tilde}>~</span>

                  <button
                    type="button"
                    onClick={() =>
                      setPicker((p) => (p === "repeatEndDate" ? "none" : "repeatEndDate"))
                    }
                    className={pillClass(picker === "repeatEndDate")}
                  >
                    {form.repeatRangeEnd
                      ? dayjs(form.repeatRangeEnd).format("M월 D일")
                      : "종료일(없음)"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setForm((p) => ({ ...p, repeatRangeStart: "", repeatRangeEnd: "" }));

                      if (picker === "repeatStartDate" || picker === "repeatEndDate") {
                        setPicker("none");
                      }
                    }}
                    className={styles.linkBtn}
                  >
                    초기화
                  </button>
                </div>
              )}

              {lockRepeatControls && (
                <div className={styles.hint}>
                  * “이 일정만”에서는 반복 규칙을 변경할 수 없습니다. (전체/이후에서 변경 가능)
                </div>
              )}
              {blockRepeatBecauseMultiDates && (
                <div className={styles.hint}>
                  * 여러 날짜에 동일 일정 추가(복제 포함)에서는 반복 설정을 사용할 수 없습니다.
                  (단건 날짜일 때만 가능)
                </div>
              )}
              {disableMultiDates && (
                <div className={styles.hint}>
                  * 반복 일정에서는 “여러 날짜에 동일 일정 추가”를 사용할 수 없습니다.
                </div>
              )}

              {(picker === "repeatStartDate" || picker === "repeatEndDate") && (
                <div className={styles.expand}>
                  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
                    <div>
                      <div className={styles.expandTitle}>
                        {picker === "repeatStartDate" ? "반복 시작일 선택" : "반복 종료일 선택"}
                      </div>

                      <DateCalendar
                        value={
                          picker === "repeatStartDate"
                            ? form.repeatRangeStart
                              ? dayjs(`${form.repeatRangeStart}T00:00`)
                              : startD
                            : form.repeatRangeEnd
                            ? dayjs(`${form.repeatRangeEnd}T00:00`)
                            : endD
                        }
                        onChange={(d) => {
                          if (!d) return;
                          if (picker === "repeatStartDate") onPickRepeatStartDate(d);
                          else onPickRepeatEndDate(d);
                        }}
                        slots={{ day: CustomDay as any }}
                        slotProps={{
                          day: {
                            holidaySet,
                          } as any,
                        }}
                        sx={{
                          "& .MuiDayCalendar-weekDayLabel:first-of-type": { color: "#dc2626" },
                          "& .MuiDayCalendar-weekDayLabel:last-of-type": { color: "#2563eb" },

                          "& .MuiYearCalendar-button": {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1,
                            paddingTop: 0,
                            paddingBottom: 0,
                          },
                        }}
                      />
                    </div>
                  </LocalizationProvider>
                </div>
              )}
            </div>
          )}
        </>

        {(mode === "create" || mode === "detail") && (
          <>
            <div
              className={styles.sectionRow}
              onClick={() => {
                const next = !multiDateOpen;
                setMultiDateOpen(next);

                if (!next && picker === "multiDates") {
                  setPicker("none");
                }
              }}
            >
              <div className={styles.sectionTitle}>
                여러 날짜에 동일 일정 추가 {mode === "detail" ? "(복제)" : ""}
              </div>

              <div className={styles.sectionRight}>
                <span className={styles.sectionSummary}>{multiDateSummary}</span>
                <span className={styles.sectionArrow}>{multiDateOpen ? "▴" : "▾"}</span>
              </div>
            </div>

            {multiDateOpen && (
              <div className={styles.sectionGrid}>
                <div className={styles.cardHeadBtns} style={{ marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openMultiDatesPicker();
                    }}
                    disabled={disableMultiDates}
                    className={pillClass(picker === "multiDates", disableMultiDates)}
                  >
                    날짜 선택
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (disableMultiDates) {
                        setFormError("반복 일정에서는 ‘여러 날짜 선택’을 사용할 수 없습니다.");
                        return;
                      }

                      clearMultiDates();

                      if (picker === "multiDates") {
                        setPicker("none");
                      }
                    }}
                    disabled={disableMultiDates}
                    className={[
                      styles.linkBtn,
                      disableMultiDates ? styles.linkBtnDisabled : "",
                    ].join(" ")}
                  >
                    초기화
                  </button>
                </div>

                <div className={styles.cardText}>
                  선택된 날짜: {(form.multiDates?.length ?? 0) > 0 ? form.multiDates.join(", ") : "없음"}
                </div>

                <div className={styles.cardSubText}>
                  {mode === "create"
                    ? "* 저장을 누르면 선택된 날짜 각각에 동일한 일정이 생성됩니다."
                    : "* ‘수정’ 버튼을 누르면 선택된 날짜들로 동일 일정이 복제 생성됩니다. (원본 일정은 그대로 유지)"}
                </div>

                {disableMultiDates && (
                  <div className={styles.cardSubText}>
                    * 현재는 반복 일정이라 다중 날짜 선택이 비활성화됩니다.
                  </div>
                )}

                {picker === "multiDates" && (
                  <div className={styles.expand}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
                      <div>
                        <div className={styles.expandTitle}>여러 날짜 선택</div>

                        {disableMultiDates ? (
                          <div className={styles.expandHint}>
                            반복 일정에서는 여러 날짜를 선택할 수 없습니다. (반복을 끄면 사용 가능)
                          </div>
                        ) : (
                          <DateCalendar
                            value={
                              form.multiDates?.[form.multiDates.length - 1]
                                ? dayjs(`${form.multiDates[form.multiDates.length - 1]}T00:00`)
                                : startD
                            }
                            onChange={(d) => {
                              if (!d) return;
                              if (disableMultiDates) {
                                setFormError("반복 일정에서는 ‘여러 날짜 선택’을 사용할 수 없습니다.");
                                return;
                              }
                              toggleMultiDate(d.format("YYYY-MM-DD"));
                            }}
                            slots={{ day: CustomDay as any }}
                            slotProps={{
                              day: {
                                holidaySet,
                                selectedSet: multiDatesSet,
                              } as any,
                            }}
                            sx={{
                              "& .MuiDayCalendar-weekDayLabel:first-of-type": { color: "#dc2626" },
                              "& .MuiDayCalendar-weekDayLabel:last-of-type": { color: "#2563eb" },
                              "& .MuiYearCalendar-button": {
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                lineHeight: 1,
                                paddingTop: 0,
                                paddingBottom: 0,
                              },
                            }}
                          />
                        )}
                      </div>
                    </LocalizationProvider>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className={styles.row}>
          <label className={styles.labelFixed}>색상</label>
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
            className={styles.colorInput}
          />
          <div className={styles.subNote}>내 고유색(추후 프로필로 이동)</div>
        </div>

        {mode === "detail" && (form.repeatSnap.repeat ?? "none") !== "none" && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>적용 범위</div>

            {(
              [
                { v: "this", label: "이 일정만" },
                { v: "following", label: "이 일정과 이후" },
                { v: "all", label: "전체 일정(모두)" },
              ] as const
            ).map((opt) => (
              <label key={opt.v} className={styles.radioRow}>
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
                <span className={styles.radioText}>{opt.label}</span>
              </label>
            ))}

            <div className={styles.cardSubText}>* “이 일정과 이후”는 과거 일정이 유지됩니다.</div>
          </div>
        )}

        <div className={styles.footer}>
          <button onClick={closeModal} className={styles.btnOutline}>
            취소
          </button>

          {mode === "create" ? (
            <button onClick={saveNew} className={styles.btnPrimary}>
              저장
            </button>
          ) : (
            <>
              <button
                onClick={deleteEvent}
                disabled={!canEdit}
                className={[styles.btnDanger, !canEdit ? styles.btnDisabled : ""].join(" ")}
              >
                삭제
              </button>
              <button
                onClick={updateEvent}
                disabled={!canEdit}
                className={[styles.btnPrimary, !canEdit ? styles.btnDisabled : ""].join(" ")}
              >
                {isDetailCloneMode ? "복제 추가" : "수정"}
              </button>
            </>
          )}
        </div>

        {!canEdit && mode === "detail" && (
          <div className={styles.bottomHint}>* 다른 사람이 만든 일정은 수정/삭제할 수 없습니다.</div>
        )}
      </div>
    </div>
  );
}