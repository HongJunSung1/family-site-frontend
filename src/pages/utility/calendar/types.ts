import type { Dayjs } from "dayjs";

export type RepeatType = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type ModalMode = "none" | "create" | "detail";

export type PickerTarget =
  | "none"
  | "startDate"
  | "startTime"
  | "endDate"
  | "endTime"
  | "repeatStartDate"
  | "repeatEndDate"
  | "multiDates";

export type ApplyScope = "this" | "following" | "all";
export type OccKey = string;

export type CalEvent = {
  id: string;
  title: string;
  start: string; // ISO (YYYY-MM-DDTHH:mm)
  end?: string;  // ISO
  allDay: boolean;
  memo?: string;
  color?: string;
  createdBy: string;

  repeat?: RepeatType;
  repeatInterval?: number;
  repeatRangeStart?: string; // "YYYY-MM-DD"
  repeatRangeEnd?: string;   // "YYYY-MM-DD"

  repeatAnchorDom?: number | null;

  repeatExceptions?: OccKey[];
  repeatOverrides?: Record<OccKey, Partial<CalEvent>>;
};

export type FormState = {
  id: string; // master id (or single id)
  title: string;
  start: string;
  end: string;
  memo: string;

  repeat: RepeatType;
  repeatInterval: number;
  repeatRangeStart: string;
  repeatRangeEnd: string;

  repeatSnap: {
    repeat: RepeatType;
    repeatInterval: number;
    repeatRangeStart: string;
    repeatRangeEnd: string;
  };

  multiDates: string[];

  color: string;
  createdBy: string;
  allDay: boolean;

  prevStartTime: string;
  prevEndTime: string;

  clickedOccKey: string;
  applyScope: ApplyScope;
};

export type DayType = "red" | "blue" | "black";

export type ViewRange = { start: Dayjs; end: Dayjs };
