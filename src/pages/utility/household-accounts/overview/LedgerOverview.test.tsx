import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLedgerOverview } from "../../../../api/ledgerApi";
import LedgerOverview from "./LedgerOverview";

vi.mock("../../../../api/ledgerApi", () => ({ getLedgerOverview: vi.fn() }));
vi.mock("@mui/x-charts/LineChart", () => ({
  LineChart: () => <div role="img" aria-label="최근 12개월 수입 지출 차액 그래프" />,
}));
const mockedGetOverview = vi.mocked(getLedgerOverview);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetOverview.mockResolvedValue({
    ok: true,
    startMonth: "2026-08",
    endMonth: "2026-08",
    currentUserId: 1,
    members: [{ user_id: 1, name: "나" }, { user_id: 2, name: "가족" }],
    totals: {
      income: "9007199254740993", expense: "15000", balance: "9007199254725993",
      transferInflow: "50000", transferOutflow: "30000",
      netCashFlow: "9007199254745993",
    },
    categories: [
      { rootId: 10, rootName: "생활", middleId: 11, middleName: "식비", income: "0", expense: "15000" },
      { rootId: 20, rootName: "소득", middleId: 21, middleName: "근로", income: "9007199254740993", expense: "0" },
    ],
    leafCategories: [
      { rootId: 10, rootName: "생활", middleId: 11, middleName: "식비", leafId: 12, leafName: "외식", income: "0", expense: "15000" },
      { rootId: 20, rootName: "소득", middleId: 21, middleName: "근로", leafId: 22, leafName: "급여", income: "9007199254740993", expense: "0" },
    ],
    history: [{ month: "2026-08", income: "9007199254740993", expense: "15000", balance: "9007199254725993" }],
    recent: [{
      id: 20, transactionDate: "2026-08-01", transactionKind: "EXPENSE", amount: "15000",
      description: "저녁 식사", counterparty: "식당", ownerName: "나",
      rootName: "생활", middleName: "식비", leafName: "외식", categoryPath: "생활 > 식비 > 외식",
    }],
  });
});

describe("가계부 월별 현황", () => {
  it("큰 금액 합계와 분류·최근 거래를 표시하고 전체 구성원 조회를 지원한다", async () => {
    render(<LedgerOverview calendarId={10} calendarName="가족" calendarControl={<span>가족 캘린더</span>} />);

    expect((await screen.findAllByText("9,007,199,254,740,993원")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("식비").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "수입 현황" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "지출 현황" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox", { name: "분류 현황 단계" })).toHaveValue("middle");
    expect(screen.getByRole("tab", { name: "대분류" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("table", { name: "대분류별 집계" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "소분류" }));
    expect(screen.getByRole("tab", { name: "소분류" })).toHaveAttribute("aria-selected", "true");
    const leafTable = screen.getByRole("table", { name: "소분류별 집계" });
    expect(within(leafTable).getByRole("columnheader", { name: "대분류" })).toBeInTheDocument();
    expect(within(leafTable).getByRole("columnheader", { name: "중분류" })).toBeInTheDocument();
    expect(within(leafTable).getByRole("columnheader", { name: "소분류" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "최근 12개월 수입 지출 차액 그래프" })).toBeInTheDocument();
    expect(screen.getByText("저녁 식사")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "소유자" })).toHaveValue("1");

    fireEvent.change(screen.getByRole("combobox", { name: "소유자" }), { target: { value: "0" } });
    await waitFor(() => expect(mockedGetOverview).toHaveBeenLastCalledWith(
      10,
      expect.any(String),
      expect.any(String),
      "all",
    ));

    fireEvent.change(screen.getByRole("combobox", { name: "최근 거래 검색 기준" }), { target: { value: "counterparty" } });
    fireEvent.change(screen.getByRole("textbox", { name: "최근 거래 검색어" }), { target: { value: "없는 거래처" } });
    expect(screen.getByText("저녁 식사")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "최근 거래 검색" }));
    expect(screen.getByText("검색 결과가 없습니다.")).toBeInTheDocument();
  });
});
