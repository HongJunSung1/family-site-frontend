import dayjs, { Dayjs } from "dayjs";

export const pad2 = (n: number) => String(n).padStart(2, "0");

export const toDayjs = (iso: string): Dayjs => {
  if (!iso) return dayjs();
  if (iso.includes("T")) return dayjs(iso);
  return dayjs(`${iso}T00:00`);
};

export const formatISO = (d: Dayjs) => d.format("YYYY-MM-DDTHH:mm");
export const addHours = (d: Dayjs, hours: number) => d.add(hours, "hour");

export const formatKoreanTimeLabel = (d: Dayjs) => {
  const h24 = d.hour();
  const m = d.minute();
  const isPM = h24 >= 12;
  const meridiem = isPM ? "오후" : "오전";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${meridiem} ${h12}:${pad2(m)}`;
};

export const formatKoreanDateLabel = (d: Dayjs) => d.format("M월 D일 (ddd)");

export function textPillBtnStyle(active: boolean): React.CSSProperties {
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

export const maxDay = (a: Dayjs, b: Dayjs) => (a.isAfter(b) ? a : b);
export const minDay = (a: Dayjs, b: Dayjs) => (a.isBefore(b) ? a : b);

export const withDateKeepingTime = (baseTime: Dayjs, ymd: string, allDay: boolean) => {
  const d = dayjs(`${ymd}T00:00`);
  if (allDay) return d.hour(0).minute(0).second(0);
  return d.hour(baseTime.hour()).minute(baseTime.minute()).second(0);
};
