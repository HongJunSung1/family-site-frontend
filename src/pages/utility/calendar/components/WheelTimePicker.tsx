import React from "react";
import type { Dayjs } from "dayjs";
import { pad2 } from "../utils/date";
import styles from "./WheelTimePicker.module.css";

type WheelTimePickerProps = {
  value: Dayjs;
  onChange: (next: Dayjs) => void;
  minutesStep?: number;
};

// 오전/오후 12시간 값을 24시간 값으로 변환
const to24h = (meridiem: "오전" | "오후", hour12: number) => {
  if (meridiem === "오전") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
};

// 11시와 12시 경계에서 오전/오후 자동 전환
const autoFlipMerIfNeeded = (prevH: number, nextH: number, curMer: "오전" | "오후") => {
  if ((prevH === 11 && nextH === 12) || (prevH === 12 && nextH === 11)) {
    return curMer === "오전" ? "오후" : "오전";
  }
  return curMer;
};

// 모바일 친화형 휠 시간 선택기
export const WheelTimePicker: React.FC<WheelTimePickerProps> = React.memo(
  ({ value, onChange, minutesStep = 5 }) => {
    const ITEM_H = 44;
    const VISIBLE = 5;
    const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
    const CENTER_OFFSET = Math.floor(VISIBLE / 2) * ITEM_H;

    // 분 단위 옵션 목록 생성
    const minuteOptions = React.useMemo(() => {
      const arr: number[] = [];
      for (let m = 0; m < 60; m += minutesStep) arr.push(m);
      return arr;
    }, [minutesStep]);

    // 현재 값에서 오전/오후, 12시간제, 가장 가까운 분 계산
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

    const merScrollTimerRef = React.useRef<number | null>(null);
    const hourScrollTimerRef = React.useRef<number | null>(null);
    const minScrollTimerRef = React.useRef<number | null>(null);

    // 필요할 때만 스크롤 위치 직접 보정
    const setScrollTopIfNeeded = (el: HTMLDivElement | null, targetTop: number) => {
      if (!el) return;
      if (Math.abs(el.scrollTop - targetTop) < 0.5) return;
      el.scrollTop = targetTop;
    };

    // 선택 인덱스가 중앙에 오도록 scrollTop 계산
    const getTargetTopByIndex = React.useCallback(
      (idx: number) => Math.max(0, PAD + idx * ITEM_H - CENTER_OFFSET),
      [PAD, ITEM_H, CENTER_OFFSET]
    );

    // 선택 항목을 휠 중앙으로 스크롤
    const scrollToCenter = React.useCallback(
      (el: HTMLDivElement | null, idx: number, smooth: boolean) => {
        if (!el) return;
        const target = getTargetTopByIndex(idx);
        el.scrollTo({
          top: target,
          behavior: smooth ? "smooth" : "auto",
        });
      },
      [getTargetTopByIndex]
    );

    // 외부 value 변경 시 휠 상태와 스크롤 위치 동기화
    React.useLayoutEffect(() => {
      setMer(derived.mer);
      setH12(derived.h12);
      setMin(derived.min);

      const merIdx = derived.mer === "오전" ? 0 : 1;
      const hourIdx = derived.h12 - 1;
      const minIdx = Math.max(0, minuteOptions.indexOf(derived.min));

      const merTop = getTargetTopByIndex(merIdx);
      const hourTop = getTargetTopByIndex(hourIdx);
      const minTop = getTargetTopByIndex(minIdx);

      setScrollTopIfNeeded(merRef.current, merTop);
      setScrollTopIfNeeded(hourRef.current, hourTop);
      setScrollTopIfNeeded(minRef.current, minTop);
    }, [derived.mer, derived.h12, derived.min, minuteOptions, getTargetTopByIndex]);

    // 선택한 시간 값을 부모 상태에 반영
    const commit = React.useCallback(
      (nextMer: "오전" | "오후", nextH12: number, nextMin: number) => {
        const h24 = to24h(nextMer, nextH12);
        onChange(value.hour(h24).minute(nextMin).second(0));
      },
      [onChange, value]
    );

    // 휠 인덱스를 유효 범위 안으로 제한
    const clampIndex = (idx: number, max: number) => Math.max(0, Math.min(idx, max));

    // 현재 스크롤 위치에서 가장 가까운 선택 인덱스 계산
    const getNearestIndexFromScrollTop = (scrollTop: number, maxIndex: number) => {
      const raw = (scrollTop + CENTER_OFFSET - PAD) / ITEM_H;
      return clampIndex(Math.round(raw), maxIndex);
    };

    // 오전/오후 인덱스 선택 반영
    const applyMerByIndex = React.useCallback(
      (idx: number, smooth: boolean) => {
        const nextMer = idx === 0 ? "오전" : "오후";
        setMer(nextMer);
        commit(nextMer, h12, min);
        scrollToCenter(merRef.current, idx, smooth);
      },
      [commit, h12, min, scrollToCenter]
    );

    // 시간 인덱스 선택 반영
    const applyHourByIndex = React.useCallback(
      (idx: number, smooth: boolean) => {
        const nextH12 = idx + 1;
        const nextMer = autoFlipMerIfNeeded(h12, nextH12, mer);

        setH12(nextH12);
        if (nextMer !== mer) setMer(nextMer);

        commit(nextMer, nextH12, min);
        scrollToCenter(hourRef.current, idx, smooth);

        if (nextMer !== mer) {
          const merIdx = nextMer === "오전" ? 0 : 1;
          scrollToCenter(merRef.current, merIdx, smooth);
        }
      },
      [commit, h12, mer, min, scrollToCenter]
    );

    // 분 인덱스 선택 반영
    const applyMinByIndex = React.useCallback(
      (idx: number, smooth: boolean) => {
        const nextMin = minuteOptions[idx];
        setMin(nextMin);
        commit(mer, h12, nextMin);
        scrollToCenter(minRef.current, idx, smooth);
      },
      [commit, minuteOptions, mer, h12, scrollToCenter]
    );

    // 스크롤 멈춤 후 가까운 항목으로 스냅 예약
    const scheduleSnap = (
      timerRef: React.MutableRefObject<number | null>,
      fn: () => void
    ) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(fn, 80);
    };

    const spacerStyle: React.CSSProperties = { height: PAD };

    return (
      <div className={styles.wrap}>
        <div
          className={styles.col}
          ref={merRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            scheduleSnap(merScrollTimerRef, () => {
              const idx = getNearestIndexFromScrollTop(el.scrollTop, 1);
              applyMerByIndex(idx, true);
            });
          }}
        >
          <div style={spacerStyle} />
          {(["오전", "오후"] as const).map((v, idx) => {
            const isSelected = v === mer;
            return (
              <button
                key={v}
                type="button"
                className={`${styles.item} ${isSelected ? styles.itemSelected : ""}`}
                onClick={() => {
                  setMer(v);
                  commit(v, h12, min);
                  scrollToCenter(merRef.current, idx, true);
                }}
              >
                {v}
              </button>
            );
          })}
          <div style={spacerStyle} />
        </div>

        <div
          className={styles.col}
          ref={hourRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            scheduleSnap(hourScrollTimerRef, () => {
              const idx = getNearestIndexFromScrollTop(el.scrollTop, 11);
              applyHourByIndex(idx, true);
            });
          }}
        >
          <div style={spacerStyle} />
          {Array.from({ length: 12 }, (_, i) => i + 1).map((v, idx) => {
            const isSelected = v === h12;
            return (
              <button
                key={v}
                type="button"
                className={`${styles.item} ${styles.timeItem} ${isSelected ? styles.itemSelected : ""}`}
                onClick={() => {
                  const nextH12 = v;
                  const nextMer = autoFlipMerIfNeeded(h12, nextH12, mer);
                  setH12(nextH12);
                  if (nextMer !== mer) setMer(nextMer);
                  commit(nextMer, nextH12, min);
                  scrollToCenter(hourRef.current, idx, true);

                  if (nextMer !== mer) {
                    const merIdx = nextMer === "오전" ? 0 : 1;
                    scrollToCenter(merRef.current, merIdx, true);
                  }
                }}
              >
                {pad2(v)}
              </button>
            );
          })}
          <div style={spacerStyle} />
        </div>

        <div
          className={styles.col}
          ref={minRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            scheduleSnap(minScrollTimerRef, () => {
              const idx = getNearestIndexFromScrollTop(el.scrollTop, minuteOptions.length - 1);
              applyMinByIndex(idx, true);
            });
          }}
        >
          <div style={spacerStyle} />
          {minuteOptions.map((v, idx) => {
            const isSelected = v === min;
            return (
              <button
                key={v}
                type="button"
                className={`${styles.item} ${styles.timeItem} ${isSelected ? styles.itemSelected : ""}`}
                onClick={() => {
                  setMin(v);
                  commit(mer, h12, v);
                  scrollToCenter(minRef.current, idx, true);
                }}
              >
                {pad2(v)}
              </button>
            );
          })}
          <div style={spacerStyle} />
        </div>
      </div>
    );
  }
);

WheelTimePicker.displayName = "WheelTimePicker";
