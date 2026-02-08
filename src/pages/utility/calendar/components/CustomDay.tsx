import type { Dayjs } from "dayjs";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import type { PickersDayProps } from "@mui/x-date-pickers/PickersDay";

type CustomDayProps = PickersDayProps & {
  holidaySet: Set<string>;
  selectedSet?: Set<string>;
};

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
        ...(isRed && { color: "#dc2626" }),
        ...(isBlue && { color: "#2563eb" }),
        ...(isSelected && {
          bgcolor: "rgba(30,42,120,0.18)",
          border: "2px solid rgba(30,42,120,0.7)",
        }),
      }}
    />
  );
}
