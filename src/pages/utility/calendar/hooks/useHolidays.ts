import { useEffect, useState } from "react";

type HolidayItem = { date: string; name?: string };

export function useHolidays(apiBase: string, holidayYear: number) {
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());
  const [holidayMap, setHolidayMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/holidays?year=${holidayYear}`);
        const data = await res.json();

        if (!alive) return;

        if (!res.ok || !data?.ok) {
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
  }, [apiBase, holidayYear]);

  return { holidaySet, holidayMap };
}
