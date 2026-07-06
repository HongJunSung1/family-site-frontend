import dayjs, { Dayjs } from "dayjs";
import type { CalEvent, RepeatType } from "../types";
import { formatISO, maxDay, minDay, toDayjs, withDateKeepingTime } from "./date";

const MAX_OCCURRENCES = 800;

export type ExpandedEvent = CalEvent & {
  __isOccurrence?: boolean;
  __masterId?: string;
  __occKey?: string;
};

const daysInMonth = (d: Dayjs) => d.daysInMonth();

/**
 * 월 반복용: anchorDOM(원래 일자)을 유지하면서,
 * 해당 월에 일자가 없으면 말일로 보정
 */
const addMonthsEomSticky = (base: Dayjs, monthsToAdd: number, anchorDOM: number) => {
  const targetMonth = base.add(monthsToAdd, "month");
  const last = daysInMonth(targetMonth);
  const day = Math.min(anchorDOM, last);
  return targetMonth.date(day);
};

const getRepeatUnit = (repeat: RepeatType): dayjs.ManipulateType | null => {
  if (repeat === "daily") return "day";
  if (repeat === "weekly") return "week";
  if (repeat === "monthly") return "month";
  if (repeat === "yearly") return "year";
  return null;
};

export const expandRecurringEvents = (items: CalEvent[], viewStart: Dayjs, viewEnd: Dayjs): ExpandedEvent[] => {
  const out: ExpandedEvent[] = [];

  for (const master of items) {
    const repeat = master.repeat ?? "none";
    if (repeat === "none") {
      out.push(master);
      continue;
    }

    const unit = getRepeatUnit(repeat);
    if (!unit) {
      out.push(master);
      continue;
    }

    const interval = Math.max(1, master.repeatInterval ?? 1);

    const baseStart = toDayjs(master.start);
    const baseEnd = toDayjs(master.end || master.start);
    const durationMin = Math.max(0, baseEnd.diff(baseStart, "minute"));

    const rangeStart = master.repeatRangeStart
      ? withDateKeepingTime(baseStart, master.repeatRangeStart, !!master.allDay)
      : baseStart;

    const rangeEndExclusive = master.repeatRangeEnd
      ? withDateKeepingTime(baseStart, master.repeatRangeEnd, !!master.allDay).add(1, "day")
      : null;

    const genStart = maxDay(viewStart, rangeStart);
    const genEnd = rangeEndExclusive ? minDay(viewEnd, rangeEndExclusive) : viewEnd;
    
    const exceptions = new Set(master.repeatExceptions ?? []);
    const overrides = master.repeatOverrides ?? {};

    // ✅ monthly는 "말일 보정이 달마다 달라야" 하므로 별도 생성 로직
    if (repeat === "monthly") {
      const anchorStart = rangeStart; // 반복 기준 시작
      const anchorDOM = Math.max(
        1,
        Math.min(31, master.repeatAnchorDom ?? anchorStart.date())
      );

      // genStart 이전까지 month index를 이동
      let k = 0;
      let guard = 0;

      // rangeStart + k*interval months가 genStart 이상이 될 때까지 증가
      while (guard < MAX_OCCURRENCES) {
        const candidate = addMonthsEomSticky(anchorStart, k * interval, anchorDOM);
        if (!candidate.isBefore(genStart)) break;
        k++;
        guard++;
      }

      let created = 0;
      while (created < MAX_OCCURRENCES) {
        const occStart = addMonthsEomSticky(anchorStart, k * interval, anchorDOM);
        if (!occStart.isBefore(genEnd)) break;

        const occEnd = occStart.add(durationMin, "minute");
        const occKey = formatISO(occStart);

        if (!exceptions.has(occKey)) {
          const ov = overrides[occKey] ?? {};
          out.push({
            ...master,
            ...ov,
            id: `${master.id}__${occStart.format("YYYYMMDDHHmm")}`,
            start: ov.start ?? formatISO(occStart),
            end: ov.end ?? formatISO(occEnd),
            __isOccurrence: true,
            __masterId: master.id,
            __occKey: occKey,
          });
        }

        k++;
        created++;
      }

      continue; // ✅ monthly 처리 끝
    }

    let cur = rangeStart;
    let guard = 0;
    while (cur.isBefore(genStart) && guard < MAX_OCCURRENCES) {
      cur = cur.add(interval, unit);
      guard++;
    }

    let created = 0;
    while (cur.isBefore(genEnd) && created < MAX_OCCURRENCES) {
      const occStart = cur;
      const occEnd = occStart.add(durationMin, "minute");
      const occKey = formatISO(occStart);

      if (!exceptions.has(occKey)) {
        const ov = overrides[occKey] ?? {};
        out.push({
          ...master,
          ...ov,
          id: `${master.id}__${occStart.format("YYYYMMDDHHmm")}`,
          start: ov.start ?? formatISO(occStart),
          end: ov.end ?? formatISO(occEnd),
          __isOccurrence: true,
          __masterId: master.id,
          __occKey: occKey,
        });
      }

      cur = cur.add(interval, unit);
      created++;
    }
  }

  return out;
};
