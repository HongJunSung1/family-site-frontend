import React from "react";
import type { Dayjs } from "dayjs";
import { pad2 } from "../utils/date";

type WheelTimePickerProps = {
  value: Dayjs;
  onChange: (next: Dayjs) => void;
  minutesStep?: number;
};

export const WheelTimePicker: React.FC<WheelTimePickerProps> = React.memo(
  ({ value, onChange, minutesStep = 5 }) => {
    const ITEM_H = 44;
    const VISIBLE = 5;
    const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
    const CENTER_OFFSET = Math.floor(VISIBLE / 2) * ITEM_H;

    const minuteOptions = React.useMemo(() => {
      const arr: number[] = [];
      for (let m = 0; m < 60; m += minutesStep) arr.push(m);
      return arr;
    }, [minutesStep]);

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
      if (Math.abs(el.scrollTop - targetTop) < 0.5) return;
      el.scrollTop = targetTop;
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
        <style>{`.wtp-col::-webkit-scrollbar { display: none; }`}</style>

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
                  scrollToCenter(merRef.current, idx, true);
                }}
              >
                {v}
              </div>
            );
          })}
          <div style={spacer} />
        </div>

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
                  scrollToCenter(hourRef.current, idx, true);
                }}
              >
                {pad2(v)}
              </div>
            );
          })}
          <div style={spacer} />
        </div>

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
                  scrollToCenter(minRef.current, idx, true);
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
WheelTimePicker.displayName = "WheelTimePicker";
