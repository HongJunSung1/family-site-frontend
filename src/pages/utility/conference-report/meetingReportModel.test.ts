import { describe, expect, it, vi } from "vitest";
import {
  canSyncActionDraftToCalendar,
  canSyncActionToCalendar,
  formatDateInput,
  getMeetingErrorMessage,
  hasActionDraftValue,
  notifyCalendarEventsChanged,
  type ActionDraft,
} from "./meetingReportModel";
import type { MeetingActionItem } from "../../../api/meetingApi";

const completeDraft: ActionDraft = {
  content: "자료 준비",
  managerId: 1,
  dueStartDate: "2026-07-18",
  dueEndDate: "2026-07-20",
  status: "todo",
  calendarColor: "#56c7a5",
};

const completeAction = {
  manager_id: 1,
  content: "자료 준비",
  due_start_date: "2026-07-18",
  due_end_date: "2026-07-20",
} as MeetingActionItem;

describe("회의록 입력 규칙", () => {
  it.each([
    ["2026", "2026"],
    ["202607", "2026-07"],
    ["20260718", "2026-07-18"],
    ["2026년 07월 18일", "2026-07-18"],
    ["202607181234", "2026-07-18"],
  ])("날짜 입력 %s를 %s 형식으로 정리", (input, expected) => {
    expect(formatDateInput(input)).toBe(expected);
  });

  it("할 일 필수값이 모두 있으면 캘린더 저장 가능", () => {
    expect(canSyncActionDraftToCalendar(completeDraft)).toBe(true);
    expect(canSyncActionToCalendar(completeAction)).toBe(true);
  });

  it.each(["content", "managerId", "dueStartDate", "dueEndDate"] as const)(
    "할 일의 %s 값이 없으면 캘린더 저장 불가",
    (field) => {
      const incomplete = {
        ...completeDraft,
        [field]: field === "managerId" ? null : "",
      };
      expect(canSyncActionDraftToCalendar(incomplete)).toBe(false);
    },
  );

  it("공백뿐인 할 일 내용은 입력값으로 판단하지 않음", () => {
    expect(hasActionDraftValue({ ...completeDraft, content: "   ", managerId: null, dueStartDate: "", dueEndDate: "" })).toBe(false);
  });

  it("네트워크 오류를 사용자 안내 문구로 변환", () => {
    expect(getMeetingErrorMessage(new TypeError("Failed to fetch"), "오류")).toContain("네트워크");
  });

  it("캘린더 일정 변경 이벤트를 전달", () => {
    const listener = vi.fn();
    window.addEventListener("family-calendar-events-changed", listener);

    notifyCalendarEventsChanged();

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("family-calendar-events-changed", listener);
  });
});
