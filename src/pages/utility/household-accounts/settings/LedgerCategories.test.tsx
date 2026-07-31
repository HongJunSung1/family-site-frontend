import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LedgerCategories from "./LedgerCategories";

const getLedgerCategories = vi.fn();
const deleteLedgerCategory = vi.fn();
const saveLedgerCategory = vi.fn();

vi.mock("../../../../api/ledgerApi", () => ({
  getLedgerCategories: (...args: unknown[]) => getLedgerCategories(...args),
  saveLedgerCategory: (...args: unknown[]) => saveLedgerCategory(...args),
  deleteLedgerCategories: (...args: unknown[]) => deleteLedgerCategory(...args),
}));

describe("가계부 분류 관리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLedgerCategories.mockResolvedValue({
      ok: true,
      categories: [],
      canManage: true,
    });
    saveLedgerCategory.mockResolvedValue({ ok: true, categoryId: 1 });
  });

  it("시트에 여러 행을 추가한 뒤 한 번에 저장한다", async () => {
    const user = userEvent.setup();
    render(
      <LedgerCategories
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<div>캘린더 선택</div>}
      />,
    );
    await waitFor(() => expect(getLedgerCategories).toHaveBeenCalledWith(10));

    await user.click(within(screen.getByRole("region", { name: "대분류 시트" })).getByRole("button", { name: /행 추가/ }));
    await user.type(screen.getByRole("textbox", { name: "대분류명" }), "수입");

    await user.click(within(screen.getByRole("region", { name: "대분류 시트" })).getByRole("button", { name: /행 추가/ }));
    await user.type(screen.getAllByRole("textbox", { name: "대분류명" })[1], "지출");

    expect(saveLedgerCategory).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
    expect(screen.getAllByRole("textbox", { name: "대분류명" })[0]).toHaveValue("수입");
    expect(screen.getAllByRole("textbox", { name: "대분류명" })[1]).toHaveValue("지출");

    await user.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveLedgerCategory).toHaveBeenCalledTimes(2));
  });

  it("기본 분류를 만들지 않고 빈 상태에서 사용자가 대분류를 추가하게 한다", async () => {
    const user = userEvent.setup();
    render(
      <LedgerCategories
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<div>캘린더 선택</div>}
      />,
    );

    await waitFor(() => expect(getLedgerCategories).toHaveBeenCalledWith(10));
    expect(screen.getByText(/등록된 대분류가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/대·중·소분류를 한 화면에서 구성/)).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("region", { name: "대분류 시트" })).getByRole("button", { name: /행 추가/ }));

    expect(screen.getByRole("textbox", { name: "대분류명" })).toHaveValue("");
    expect(within(screen.getByRole("region", { name: "대분류 시트" })).getByText("A")).toBeInTheDocument();
  });

  it("저장 전 대·중·소분류를 연결하고 실제 상위 코드로 치환해 저장한다", async () => {
    const user = userEvent.setup();
    saveLedgerCategory
      .mockResolvedValueOnce({ ok: true, categoryId: 101 })
      .mockResolvedValueOnce({ ok: true, categoryId: 201 })
      .mockResolvedValueOnce({ ok: true, categoryId: 301 });
    render(
      <LedgerCategories
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<div>캘린더 선택</div>}
      />,
    );
    await waitFor(() => expect(getLedgerCategories).toHaveBeenCalledWith(10));

    await user.click(within(screen.getByRole("region", { name: "대분류 시트" })).getByRole("button", { name: /행 추가/ }));
    await user.type(screen.getByRole("textbox", { name: "대분류명" }), "생활");
    await user.dblClick(screen.getByRole("textbox", { name: "대분류명" }));
    await user.click(within(screen.getByRole("region", { name: "중분류 시트" })).getByRole("button", { name: /행 추가/ }));
    await user.type(screen.getByRole("textbox", { name: "중분류명" }), "식비");
    await user.dblClick(screen.getByRole("textbox", { name: "중분류명" }));
    await user.click(within(screen.getByRole("region", { name: "소분류 시트" })).getByRole("button", { name: /행 추가/ }));
    await user.type(screen.getByRole("textbox", { name: "소분류명" }), "외식");

    await user.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(saveLedgerCategory).toHaveBeenCalledTimes(3));
    expect(saveLedgerCategory.mock.calls[0][0]).toMatchObject({ parentId: null, name: "생활" });
    expect(saveLedgerCategory.mock.calls[1][0]).toMatchObject({ parentId: 101, name: "식비" });
    expect(saveLedgerCategory.mock.calls[2][0]).toMatchObject({ parentId: 201, name: "외식" });
  });

  it("대분류 선택 후에도 중분류를 별도로 선택하기 전에는 소분류를 표시하지 않는다", async () => {
    const user = userEvent.setup();
    getLedgerCategories.mockResolvedValue({
      ok: true,
      canManage: true,
      categories: [
        { id: 1, calendar_id: 10, parent_id: null, category_name: "생활", depth: 1, is_active: 1, display_order: 0, created_at: "", updated_at: "" },
        { id: 2, calendar_id: 10, parent_id: 1, category_name: "식비", depth: 2, is_active: 1, display_order: 0, created_at: "", updated_at: "" },
        { id: 3, calendar_id: 10, parent_id: 2, category_name: "외식", depth: 3, is_active: 1, display_order: 0, created_at: "", updated_at: "" },
      ],
    });
    render(
      <LedgerCategories
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<div>캘린더 선택</div>}
      />,
    );

    await user.dblClick(await screen.findByRole("textbox", { name: "대분류명" }));
    expect(screen.getByRole("textbox", { name: "중분류명" })).toHaveValue("식비");
    expect(screen.queryByRole("textbox", { name: "소분류명" })).not.toBeInTheDocument();

    await user.dblClick(screen.getByRole("textbox", { name: "중분류명" }));
    expect(screen.getByRole("textbox", { name: "소분류명" })).toHaveValue("외식");
  });

  it("다른 상위 분류를 조회하면 숨겨지는 미저장 입력과 삭제 선택을 초기화한다", async () => {
    const user = userEvent.setup();
    getLedgerCategories.mockResolvedValue({
      ok: true,
      canManage: true,
      categories: [
        { id: 1, calendar_id: 10, parent_id: null, category_name: "생활", depth: 1, is_active: 1, display_order: 0, created_at: "", updated_at: "" },
        { id: 4, calendar_id: 10, parent_id: null, category_name: "금융", depth: 1, is_active: 1, display_order: 1, created_at: "", updated_at: "" },
        { id: 2, calendar_id: 10, parent_id: 1, category_name: "식비", depth: 2, is_active: 1, display_order: 0, created_at: "", updated_at: "" },
        { id: 3, calendar_id: 10, parent_id: 2, category_name: "외식", depth: 3, is_active: 1, display_order: 0, created_at: "", updated_at: "" },
      ],
    });
    render(
      <LedgerCategories
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<div>캘린더 선택</div>}
      />,
    );

    await user.dblClick(await screen.findByDisplayValue("생활"));
    await user.dblClick(screen.getByDisplayValue("식비"));
    const leafName = screen.getByDisplayValue("외식");
    await user.clear(leafName);
    await user.type(leafName, "외식 변경");
    await user.click(screen.getByRole("checkbox", { name: "외식 변경 삭제 선택" }));

    await user.dblClick(screen.getByDisplayValue("금융"));
    expect(screen.getByRole("dialog")).toHaveTextContent("작성하고 저장하지 않은 데이터 1건이 삭제됩니다.");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "계속" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.dblClick(screen.getByDisplayValue("생활"));
    await user.dblClick(screen.getByDisplayValue("식비"));

    expect(screen.getByDisplayValue("외식")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "외식 삭제 선택" })).not.toBeChecked();
  });

  it("상위 분류 삭제로 체크하지 않은 미저장 하위 행도 사라지면 확인창에 안내한다", async () => {
    const user = userEvent.setup();
    getLedgerCategories.mockResolvedValue({
      ok: true,
      canManage: true,
      categories: [
        { id: 1, calendar_id: 10, parent_id: null, category_name: "생활", depth: 1, is_active: 1, display_order: 0, created_at: "", updated_at: "" },
        { id: 2, calendar_id: 10, parent_id: 1, category_name: "식비", depth: 2, is_active: 1, display_order: 0, created_at: "", updated_at: "" },
      ],
    });
    render(
      <LedgerCategories
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<div>캘린더 선택</div>}
      />,
    );

    await user.dblClick(await screen.findByDisplayValue("생활"));
    await user.dblClick(screen.getByDisplayValue("식비"));
    await user.click(within(screen.getByRole("region", { name: "소분류 시트" })).getByRole("button", { name: /행 추가/ }));
    await user.type(screen.getByRole("textbox", { name: "소분류명" }), "외식");
    await user.click(screen.getByRole("checkbox", { name: "식비 삭제 선택" }));
    await user.click(screen.getByRole("button", { name: "삭제" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("저장하지 않은 데이터 1건도 함께 삭제됩니다.");
  });

  it("삭제 확인 즉시 분류 삭제 API를 호출한다", async () => {
    const user = userEvent.setup();
    getLedgerCategories.mockResolvedValue({
      ok: true,
      canManage: true,
      categories: [{
        id: 31,
        calendar_id: 10,
        parent_id: null,
        category_name: "지출",
        depth: 1,
        category_kind: "EXPENSE",
        is_active: 1,
        display_order: 0,
        created_at: "2026-07-30",
        updated_at: "2026-07-30",
      }],
    });
    deleteLedgerCategory.mockResolvedValue({ ok: true });

    render(
      <LedgerCategories
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<div>캘린더 선택</div>}
      />,
    );

    const table = await screen.findByRole("table", { name: "1단계 분류 편집 시트" });
    await user.click(within(table).getByRole("checkbox", { name: "지출 삭제 선택" }));
    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(deleteLedgerCategory).toHaveBeenCalledWith([31]));
  });

  it("삭제가 차단되면 공통 안내 대화상자에 오류를 표시한다", async () => {
    const user = userEvent.setup();
    getLedgerCategories.mockResolvedValue({
      ok: true,
      canManage: true,
      categories: [{
        id: 41,
        calendar_id: 10,
        parent_id: null,
        category_name: "지출",
        depth: 1,
        category_kind: "EXPENSE",
        is_active: 1,
        display_order: 0,
        created_at: "2026-07-30",
        updated_at: "2026-07-30",
      }],
    });
    deleteLedgerCategory.mockRejectedValue(new Error("삭제 차단"));

    render(
      <LedgerCategories
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<div>캘린더 선택</div>}
      />,
    );

    const table = await screen.findByRole("table", { name: "1단계 분류 편집 시트" });
    await user.click(within(table).getByRole("checkbox", { name: "지출 삭제 선택" }));
    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("분류 삭제 불가");
    expect(screen.getByRole("dialog")).toHaveTextContent("분류를 삭제하지 못했습니다.");
  });
});
