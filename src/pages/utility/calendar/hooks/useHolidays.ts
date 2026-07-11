import { useEffect, useState } from "react";
import { getHolidays, type HolidayItem } from "../../../../api/calendarApi";

// 선택 연도의 공휴일 목록과 날짜별 공휴일명 조회
export function useHolidays(holidayYear: number) {
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());
  const [holidayMap, setHolidayMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await getHolidays(holidayYear);

        if (!alive) return;

        if (!data?.ok) {
          setHolidaySet(new Set());
          setHolidayMap(new Map());
          return;
        }

        const s = new Set<string>();
        const m = new Map<string, string>();

        for (const h of (data.holidays ?? []) as HolidayItem[]) {
          if (!h?.date) continue;
          s.add(h.date);
          if (h?.name) m.set(h.date, h.name);
        }

        setHolidaySet(s);
        setHolidayMap(m);
      } catch {
        if (!alive) return;
        setHolidaySet(new Set());
        setHolidayMap(new Map());
      }
    })();

    return () => {
      alive = false;
    };
  }, [holidayYear]);

  return { holidaySet, holidayMap };
}
