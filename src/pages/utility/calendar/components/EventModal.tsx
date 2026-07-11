// EventModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/ko";

import Switch from "@mui/material/Switch";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";

import type { ApplyScope, FormState, ModalMode, PickerTarget, RepeatType } from "../types";
import { CustomDay } from "./CustomDay";
import { AlertDialog, ConfirmDialog } from "../../../../common/dialog";
import { Input, InputField, TextareaField } from "../../../../common/input";
import { EventColorPicker } from "./EventColorPicker";
import { EventLocationPicker } from "./EventLocationPicker";
import { WheelTimePicker } from "./WheelTimePicker";
import { useDraggableModal } from "../hooks/useDraggableModal";
import { useFavoriteColors } from "../hooks/useFavoriteColors";
import { formatKoreanDateLabel, formatKoreanTimeLabel, toDayjs } from "../utils/date";

import styles from "./EventModal.module.css";

type Props = {
  mode: ModalMode;
  presentation?: "modal" | "sideCard";

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

// 일정 추가/상세 입력 화면과 날짜, 반복, 색상, 지도 설정 관리
export function EventModal(props: Props) {
  const {
    mode,
    presentation = "modal",
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

  // 여러 날짜 선택 달력의 선택 여부 확인용 Set
  const multiDatesSet = useMemo(() => new Set(form.multiDates ?? []), [form.multiDates]);

  // 반복 일정과 여러 날짜 복제 기능 동시 사용 제한
  const isRecurring =
    (form.repeat ?? "none") !== "none" || (form.repeatSnap?.repeat ?? "none") !== "none";
  const disableMultiDates = isRecurring;

  const isMultiDateMode = (form.multiDates?.length ?? 0) >= 2;
  const blockRepeatBecauseMultiDates = isMultiDateMode;

  // 삭제 버튼
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [alertDialog, setAlertDialog] = useState({
    open: false,
    title: "",
    message: "",
  });

  // 하위 기능의 공통 안내창 호출 헬퍼
  const showAlertDialog = React.useCallback((message: string, title = "안내") => {
    setAlertDialog({ open: true, title, message });
  }, []);

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
  const { favoriteColors, savingColor, saveFavoriteColor, deleteFavoriteColor } =
    useFavoriteColors({ onAlert: showAlertDialog });

  // 취소/X 버튼 클릭 시 수정 내역 유실 확인창 표시
  const requestCloseModal = () => {
    setCloseConfirmOpen(true);
  };

  // 닫기 확인창 확인 시 실제 모달 닫기
  const confirmCloseModal = () => {
    setCloseConfirmOpen(false);
    closeModal();
  };

  // 자주 쓰는 색상 변경
  // 자주 쓰는 색상 드롭다운

  // 자주 쓰는 색상 간편 저장



  // 자주 쓰는 색상 조회


  // 날짜 버튼의 주말/공휴일 색상 계산
  const dateTextColor = (d: Dayjs) => {
    const t = getDayType(d);
    if (t === "red") return "#dc2626";
    if (t === "blue") return "#2563eb";
    return "var(--event-modal-date-text)";
  };

  // MUI 날짜 선택기의 라이트/다크모드와 선택 상태 스타일 통일
  const calendarSx = {
    color: "var(--color-text)",
    "& .MuiPickersCalendarHeader-label": { color: "var(--color-text)" },
    "& .MuiPickersArrowSwitcher-button": { color: "var(--color-text)" },
    "& .MuiDayCalendar-weekDayLabel": { color: "var(--color-text-muted)" },
    "& .MuiDayCalendar-weekDayLabel:first-of-type": { color: "#dc2626" },
    "& .MuiDayCalendar-weekDayLabel:last-of-type": { color: "#2563eb" },
    "& .MuiPickersDay-root": { color: "var(--event-modal-calendar-day)" },
    "& .MuiPickersDay-root.Mui-selected": {
      color: "#ffffff",
      backgroundColor: "var(--color-primary)",
    },
    "& .MuiPickersDay-root.Mui-selected:hover": {
      backgroundColor: "var(--color-primary-hover)",
    },
    "& .MuiPickersDay-root.Mui-disabled": {
      color: "var(--color-text-muted)",
      opacity: 0.45,
    },
    "& .MuiYearCalendar-button": {
      color: "var(--color-text)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      paddingTop: 0,
      paddingBottom: 0,
    },
  };

  // 날짜/시간 pill 버튼의 활성/비활성 클래스 조합
  const pillClass = (active: boolean, disabled?: boolean) =>
    [styles.pillBtn, active ? styles.pillBtnActive : "", disabled ? styles.pillBtnDisabled : ""]
      .filter(Boolean)
      .join(" ");

  const [repeatOpen, setRepeatOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [multiDateOpen, setMultiDateOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  // 날짜 선택기 직접 열기와 아코디언 자동 펼침
  useEffect(() => {
    if (picker === "repeatStartDate" || picker === "repeatEndDate") {
      setRepeatOpen(true);
    }
    if (picker === "multiDates") {
      setMultiDateOpen(true);
    }
  }, [picker]);

  // 접힌 반복 섹션에 표시할 현재 반복 설정 요약
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

  // 접힌 여러 날짜 섹션의 선택 날짜 개수 요약
  const multiDateSummary =
    (form.multiDates?.length ?? 0) > 0
      ? `${form.multiDates?.length ?? 0}개 날짜 선택됨`
      : "선택된 날짜 없음";

  const { dragOffset, modalRef, handleDragStart } = useDraggableModal();

  // 반복 유형 변경과 여러 날짜 선택 충돌 방지
  const onChangeRepeat = (next: RepeatType) => {
    setFormError("");

    if (next === "none" && (picker === "repeatStartDate" || picker === "repeatEndDate")) {
      setPicker("none");
    }

    setForm((p) => {
      const nextRepeat = next;

      if (nextRepeat !== "none" && (p.multiDates?.length ?? 0) >= 2) return p;

      return {
        ...p,
        repeat: nextRepeat,
        repeatInterval: Math.max(1, p.repeatInterval || 1),
      };
    });
  };

  // 여러 날짜 선택 달력 열기와 반복 일정 사용 제한
  const openMultiDatesPicker = () => {
    if (disableMultiDates) {
      setFormError("반복 일정에서는 여러 날짜 선택을 사용할 수 없습니다.");
      return;
    }
    setMultiDateOpen(true);
    setPicker((p) => (p === "multiDates" ? "none" : "multiDates"));
  };

  // 상세 화면 여러 날짜 선택 시 기존 일정 수정 대신 복제 추가 처리
  const isDetailCloneMode =
    mode === "detail" && (form.multiDates?.length ?? 0) > 0 && !disableMultiDates;

  // 시작 날짜 선택 버튼
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

  // 시작 시간 선택 버튼
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

  // 종료 날짜 선택 버튼
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

  // 종료 시간 선택 버튼
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
    <div className={`${styles.overlay} ${presentation === "sideCard" ? styles.overlaySideCard : ""}`}>
      <div
        ref={modalRef}
        className={`${styles.modal} ${presentation === "sideCard" ? styles.modalSideCard : ""}`}
        style={
          presentation === "sideCard"
            ? undefined
            : { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
        }
      >
        <button onClick={requestCloseModal} className={styles.closeBtn} aria-label="close">
          ×
        </button>

        <div
          className={styles.header}
          onMouseDown={presentation === "sideCard" ? undefined : handleDragStart}
        >
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
                <div className={styles.rangeHint}>시작</div>
                <div className={styles.rangeLabelSpacer} />
                <div className={styles.rangeHint}>종료</div>

                <div className={styles.pillRow}>
                  {StartDateBtn}
                  {StartTimeBtn}
                </div>
                <div className={styles.rangeArrow}>~</div>
                <div className={styles.pillRow}>
                  {EndDateBtn}
                  {EndTimeBtn}
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

                            if (picker === "startDate") {
                              onPickStartDate(d);
                              setPicker("endDate");
                              return;
                            }

                            if (picker === "endDate") {
                              onPickEndDate(d);
                              setPicker("none");
                            }
                          }}
                          slots={{ day: CustomDay as any }}
                          slotProps={{
                            day: {
                              holidaySet,
                            } as any,
                          }}
                          sx={calendarSx}
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
                            * 하루 종일이 켜져 있어 시간 변경은 비활성화됩니다.
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
          <InputField
            label="제목"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="일정을 입력해주세요."
            className={styles.eventFormControl}
            autoFocus
          />
        </div>

        <>
          <div
            className={styles.sectionRow}
            onClick={() => setMemoOpen((prev) => !prev)}
          >
            <div className={styles.sectionTitle}>메모</div>

            <div className={styles.sectionRight}>
              <span className={styles.sectionSummary}>
                {form.memo.trim() ? "입력됨" : "없음"}
              </span>
              <span className={styles.sectionArrow}>{memoOpen ? "▲" : "▼"}</span>
            </div>
          </div>

          <div className={`${styles.collapsible} ${memoOpen ? styles.collapsibleOpen : ""}`}>
            <div className={`${styles.sectionGrid} ${styles.collapsibleInner}`}>
              <TextareaField
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                height={92}
                placeholder="일정 관련 상세 내용을 입력해주세요."
                className={styles.eventFormControl}
              />
            </div>
          </div>
        </>
        <EventLocationPicker
          mode={mode}
          form={form}
          setForm={setForm}
          mapOpen={mapOpen}
          setMapOpen={setMapOpen}
          setFormError={setFormError}
        />
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
              <span className={styles.sectionArrow}>{repeatOpen ? "▲" : "▼"}</span>
            </div>
          </div>

          <div className={`${styles.collapsible} ${repeatOpen ? styles.collapsibleOpen : ""}`}>
            <div className={`${styles.sectionGrid} ${styles.collapsibleInner}`}>
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

                <Input
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
                      : "시작일 없음"}
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
                      : "종료일 없음"}
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
                  * 이 일정만에서는 반복 규칙을 변경할 수 없습니다. (전체/이후에서 변경 가능)
                </div>
              )}
              {blockRepeatBecauseMultiDates && (
                <div className={styles.hint}>
                  * 여러 날짜에 동일 일정 추가(복제 포함)에서는 반복 설정을 사용할 수 없습니다.
                  (단건 날짜에서만 가능)
                </div>
              )}
              {disableMultiDates && (
                <div className={styles.hint}>
                  * 반복 일정에서는 여러 날짜에 동일 일정 추가를 사용할 수 없습니다.
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
                          if (picker === "repeatStartDate") {
                            onPickRepeatStartDate(d);
                            setPicker("repeatEndDate");
                            return;
                          }

                          if (picker === "repeatEndDate") {
                            onPickRepeatEndDate(d);
                            setPicker("none");
                          }
                        }}
                        slots={{ day: CustomDay as any }}
                        slotProps={{
                          day: {
                            holidaySet,
                          } as any,
                        }}
                        sx={calendarSx}
                      />
                    </div>
                  </LocalizationProvider>
                </div>
              )}
            </div>
          </div>
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
                <span className={styles.sectionArrow}>{multiDateOpen ? "▲" : "▼"}</span>
              </div>
            </div>

            <div className={`${styles.collapsible} ${multiDateOpen ? styles.collapsibleOpen : ""}`}>
              <div className={`${styles.sectionGrid} ${styles.collapsibleInner}`}>
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
                        setFormError("반복 일정에서는 여러 날짜 선택을 사용할 수 없습니다.");
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
                  선택한 날짜: {(form.multiDates?.length ?? 0) > 0 ? form.multiDates.join(", ") : "없음"}
                </div>

                <div className={styles.cardSubText}>
                  {mode === "create"
                    ? "* 저장을 누르면 선택한 날짜 각각에 동일한 일정이 생성됩니다."
                    : "* 수정 버튼을 누르면 선택한 날짜로 동일 일정의 복제가 생성됩니다. (원본 일정은 그대로 유지)"}
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
                                setFormError("반복 일정에서는 여러 날짜 선택을 사용할 수 없습니다.");
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
                            sx={calendarSx}
                          />
                        )}
                      </div>
                    </LocalizationProvider>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className={`${styles.row} ${styles.colorRow}`}>
          <label className={styles.labelFixed}>색상</label>

          <EventColorPicker
            color={form.color}
            favoriteColors={favoriteColors}
            savingColor={savingColor}
            onColorChange={(color) => setForm((p) => ({ ...p, color }))}
            onSaveFavoriteColor={saveFavoriteColor}
            onDeleteFavoriteColor={deleteFavoriteColor}
          />
        </div>
        {mode === "detail" && (form.repeatSnap.repeat ?? "none") !== "none" && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>적용 범위</div>

            {(
              [
                { v: "this", label: "이 일정만" },
                { v: "following", label: "이 일정과 이후" },
                { v: "all", label: "전체 일정" },
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

            <div className={styles.cardSubText}>* 이 일정과 이후는 과거 일정을 제외합니다.</div>
          </div>
        )}

        <div className={styles.footer}>
          <button onClick={requestCloseModal} className={styles.btnOutline}>
            취소
          </button>

          {mode === "create" ? (
            <button onClick={saveNew} className={styles.btnPrimary}>
              저장
            </button>
          ) : (
            <>
              <button
                onClick={() => setDeleteOpen(true)}
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

        <ConfirmDialog
          open={deleteOpen}
          title="삭제 확인"
          message="정말 삭제하시겠습니까?"
          cancelLabel="취소"
          confirmLabel="삭제"
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false);
            deleteEvent();
          }}
        />

        <ConfirmDialog
          open={closeConfirmOpen}
          title="입력 취소"
          message="이 창을 닫으면 현재 수정 내역이 사라집니다. 계속하시겠습니까?"
          cancelLabel="아니요"
          confirmLabel="예"
          onClose={() => setCloseConfirmOpen(false)}
          onConfirm={confirmCloseModal}
        />

        <AlertDialog
          open={alertDialog.open}
          title={alertDialog.title}
          message={alertDialog.message}
          onClose={() => setAlertDialog((prev) => ({ ...prev, open: false }))}
        />
      </div>
    </div>
  );
}
