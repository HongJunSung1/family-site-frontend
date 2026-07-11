import dayjs, { Dayjs } from "dayjs";

// 숫자 두 자리 문자열 변환
export const pad2 = (n: number) => String(n).padStart(2, "0");

// ISO 문자열을 dayjs 객체로 변환
export const toDayjs = (iso: string): Dayjs => {
  if (!iso) return dayjs();
  if (iso.includes("T")) return dayjs(iso);
  return dayjs(`${iso}T00:00`);
};

// dayjs 객체를 일정 API용 ISO 문자열로 변환
export const formatISO = (d: Dayjs) => d.format("YYYY-MM-DDTHH:mm");

// 지정 시간만큼 더한 dayjs 객체 생성
export const addHours = (d: Dayjs, hours: number) => d.add(hours, "hour");

// 한국어 오전/오후 시간 라벨 생성
export const formatKoreanTimeLabel = (d: Dayjs) => {
  const h24 = d.hour();
  const m = d.minute();
  const isPM = h24 >= 12;
  const meridiem = isPM ? "오후" : "오전";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${meridiem} ${h12}:${pad2(m)}`;
};

// 한국어 날짜 라벨 생성
export const formatKoreanDateLabel = (d: Dayjs) => d.format("M월 D일 (ddd)");

// pill 형태 날짜/시간 버튼 인라인 스타일 생성
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

// 더 늦은 날짜 반환
export const maxDay = (a: Dayjs, b: Dayjs) => (a.isAfter(b) ? a : b);

// 더 이른 날짜 반환
export const minDay = (a: Dayjs, b: Dayjs) => (a.isBefore(b) ? a : b);

// 날짜만 바꾸고 기존 시간은 유지한 dayjs 객체 생성
export const withDateKeepingTime = (baseTime: Dayjs, ymd: string, allDay: boolean) => {
  const d = dayjs(`${ymd}T00:00`);
  if (allDay) return d.hour(0).minute(0).second(0);
  return d.hour(baseTime.hour()).minute(baseTime.minute()).second(0);
};
