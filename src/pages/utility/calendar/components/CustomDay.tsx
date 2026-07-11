import type { Dayjs } from "dayjs";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import type { PickersDayProps } from "@mui/x-date-pickers/PickersDay";

type CustomDayProps = PickersDayProps & {
  holidaySet: Set<string>;
  selectedSet?: Set<string>;
};

// 날짜 선택 달력의 공휴일/주말/선택 날짜 색상 표시
export function CustomDay(props: CustomDayProps) {
  const { day, outsideCurrentMonth, holidaySet, selectedSet, ...other } = props;

  const d = day as unknown as Dayjs;
  const ymd = d.format("YYYY-MM-DD");

  const isHol = holidaySet.has(ymd);
  const dow = d.day();
  const isRed = isHol || dow === 0;
  const isBlue = dow === 6;

  const isSelected = selectedSet?.has(ymd);

  return (
    <PickersDay
      day={day}
      outsideCurrentMonth={outsideCurrentMonth}
      {...other}
      sx={{
        color: "var(--event-modal-calendar-day)",
        ...(isRed && { color: "#dc2626" }),
        ...(isBlue && { color: "#2563eb" }),
        ...(isSelected && {
          color: "#ffffff",
          bgcolor: "var(--color-primary)",
          border: "2px solid var(--color-primary-hover)",
          boxShadow: "0 0 0 2px var(--color-focus-ring)",
          "&:hover": {
            bgcolor: "var(--color-primary-hover)",
          },
        }),
      }}
    />
  );
}
