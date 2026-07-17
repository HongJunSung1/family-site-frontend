import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MeetingAgenda } from "../../../api/meetingApi";
import { AgendaEditor } from "./AgendaEditor";
import type { MeetingReportController } from "./useMeetingReport";

const agenda = { id: 7 } as MeetingAgenda;

// 안건 편집에 필요한 컨트롤러 값만 구성
function createReport(overrides: Record<string, unknown> = {}) {
  return {
    handleAddAgenda: vi.fn(),
    handleSaveAgenda: vi.fn(),
    setAgendaCancelMode: vi.fn(),
    agendaTitle: "",
    setAgendaTitle: vi.fn(),
    agendaPriority: "normal",
    setAgendaPriority: vi.fn(),
    agendaStatus: "waiting",
    setAgendaStatus: vi.fn(),
    editingAgendaDraft: {
      title: "여름 일정",
      priority: "normal",
      status: "waiting",
    },
    setEditingAgendaDraft: vi.fn(),
    ...overrides,
  } as unknown as MeetingReportController;
}

describe("안건 편집", () => {
  it("편집 중인 안건 제목·중요도·상태 표시", () => {
    render(<AgendaEditor report={createReport()} agenda={agenda} />);

    expect(screen.getByLabelText("안건 제목")).toHaveValue("여름 일정");
    expect(screen.getByLabelText("중요도")).toHaveValue("normal");
    expect(screen.getByLabelText("상태")).toHaveValue("waiting");
  });

  it("안건 제목 변경을 편집 상태에 반영", () => {
    const setEditingAgendaDraft = vi.fn();
    const report = createReport({ setEditingAgendaDraft });
    render(<AgendaEditor report={report} agenda={agenda} />);

    fireEvent.change(screen.getByLabelText("안건 제목"), { target: { value: "변경된 안건" } });

    expect(setEditingAgendaDraft).toHaveBeenCalledWith({
      title: "변경된 안건",
      priority: "normal",
      status: "waiting",
    });
  });

  it("저장과 취소 버튼이 각각 컨트롤러 동작 실행", () => {
    const handleSaveAgenda = vi.fn();
    const setAgendaCancelMode = vi.fn();
    render(
      <AgendaEditor
        report={createReport({ handleSaveAgenda, setAgendaCancelMode })}
        agenda={agenda}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(handleSaveAgenda).toHaveBeenCalledWith(agenda);
    expect(setAgendaCancelMode).toHaveBeenCalledWith("edit");
  });

  it("편집 상태가 없으면 기존 안건 입력 화면을 렌더링하지 않음", () => {
    const { container } = render(
      <AgendaEditor report={createReport({ editingAgendaDraft: null })} agenda={agenda} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
