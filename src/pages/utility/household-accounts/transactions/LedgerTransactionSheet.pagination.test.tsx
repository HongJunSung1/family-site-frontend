import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssetAccount } from "../../../../api/assetApi";
import type { LedgerCategory, LedgerTransaction } from "../../../../api/ledgerApi";
import LedgerTransactionSheet from "./LedgerTransactionSheet";

const account = { id: 1, institution_name: "국민은행", account_name: "생활비 통장" } as AssetAccount;
const categories = [
  { id: 1, parent_id: null, category_name: "생활", depth: 1, is_active: 1 },
  { id: 2, parent_id: 1, category_name: "식비", depth: 2, is_active: 1 },
  { id: 3, parent_id: 2, category_name: "카페", depth: 3, is_active: 1 },
] as LedgerCategory[];

const transaction = (id: number): LedgerTransaction => ({
  id,
  calendar_id: 10,
  account_id: 1,
  owner_user_id: 1,
  owner_name: "사용자",
  account_name: "생활비 통장",
  category_id: 3,
  category_name: "카페",
  transaction_date: "2026-09-27",
  transaction_time: "12:30",
  direction: "OUTFLOW",
  transaction_kind: "EXPENSE",
  amount: "5000",
  description: `거래 ${id}`,
  counterparty: "",
  memo: "",
});

describe("거래내역 페이지 이동", () => {
  const renderSheet = (rows: LedgerTransaction[], onDateRangeChange = vi.fn()) => render(
    <LedgerTransactionSheet calendarId={10} rows={rows} accounts={[account]}
      categories={[...categories, { id: 4, parent_id: 2, category_name: "이벤트수익", depth: 3, is_active: 1 } as LedgerCategory]}
      canManage onReload={vi.fn()} startDate="2026-09-01" endDate="2026-09-30"
      onDateRangeChange={onDateRangeChange} />,
  );

  it("날짜 변경은 포커스를 벗어날 때만 반영하고 역전된 기간도 그대로 전달한다", () => {
    const onDateRangeChange = vi.fn();
    renderSheet([], onDateRangeChange);
    const start = screen.getByLabelText("거래 시작일");
    fireEvent.change(start, { target: { value: "2026-10-01" } });
    expect(onDateRangeChange).not.toHaveBeenCalled();
    fireEvent.blur(start);
    expect(onDateRangeChange).toHaveBeenCalledExactlyOnceWith("2026-10-01", "2026-09-30");
  });

  it("미연결 이체만 표시하고 필터를 해제하면 전체 내역을 복원한다", () => {
    renderSheet([
      transaction(1),
      { ...transaction(2), transaction_kind: "TRANSFER" },
      { ...transaction(3), transaction_kind: "TRANSFER", transfer_link_id: 10 },
    ]);
    fireEvent.click(screen.getByLabelText("미연결 계좌이체내역 보기"));
    expect(screen.getByDisplayValue("거래 2")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("거래 1")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("거래 3")).not.toBeInTheDocument();
    expect(screen.getByLabelText("조회합계")).toHaveTextContent("이체 출금 5,000원");
    fireEvent.click(screen.getByLabelText("미연결 계좌이체내역 보기"));
    expect(screen.getByDisplayValue("거래 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("거래 3")).toBeInTheDocument();
  });

  it("이벤트수익 제외와 합산을 전환하며 취소 거래를 차감하고 합산 행 편집을 막는다", () => {
    renderSheet([
      transaction(1),
      { ...transaction(2), category_id: 4, category_name: "이벤트수익", transaction_kind: "INCOME", amount: "12000" },
      { ...transaction(3), category_id: 4, category_name: "이벤트수익", transaction_kind: "INCOME", amount: "2000", is_reversal: 1 },
    ]);
    const filter = screen.getByLabelText("이벤트수익 표시");
    fireEvent.change(filter, { target: { value: "exclude" } });
    expect(screen.queryByDisplayValue("거래 2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("조회합계")).toHaveTextContent("수입 0원");
    fireEvent.change(filter, { target: { value: "sum" } });
    const summaryRow = screen.getByText("수익 합산").closest("tr")!;
    expect(summaryRow).toHaveTextContent("10,000");
    expect(within(summaryRow).getByLabelText("거래 선택")).toBeDisabled();
    expect(screen.getByLabelText("조회합계")).toHaveTextContent("수입 10,000원");
    fireEvent.click(within(summaryRow).getByRole("button", { name: "상세" }));
    const detail = summaryRow.nextElementSibling as HTMLElement;
    expect(within(detail).getByLabelText("취소 거래")).toBeDisabled();
    expect(within(detail).getByText("대분류").nextElementSibling).toHaveTextContent("생활");
    expect(within(detail).getByText("중분류").nextElementSibling).toHaveTextContent("식비");
    for (const label of ["원거래", "이체 연결", "입력 경로", "분류 방식"]) {
      expect(within(detail).getByText(label).nextElementSibling).toBeEmptyDOMElement();
    }
    fireEvent.change(filter, { target: { value: "all" } });
    expect(screen.getByDisplayValue("거래 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("거래 3")).toBeInTheDocument();
  });

  it("10·20·50·100건 단위를 선택하고 다음 페이지의 거래를 조회한다", async () => {
    render(
      <LedgerTransactionSheet
        calendarId={10}
        rows={Array.from({ length: 21 }, (_, index) => transaction(index + 1))}
        accounts={[account]}
        categories={categories}
        canManage
        onReload={vi.fn()}
        startDate="2026-09-01"
        endDate="2026-09-30"
        onDateRangeChange={vi.fn()}
      />,
    );

    const pageSize = screen.getByRole("combobox", { name: "페이지당 거래 건수" });
    expect(within(pageSize).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["10개", "20개", "50개", "100개"]);
    expect(pageSize).toHaveValue("50");
    expect(screen.getAllByRole("combobox", { name: "계정" })[0]).toHaveValue("국민은행 · 생활비 통장");
    expect(Number.parseInt(screen.getByRole("columnheader", { name: "계정" }).style.width, 10)).toBeGreaterThan(150);
    expect(screen.getByLabelText("조회합계")).toHaveTextContent("수입 0원");
    expect(screen.getByLabelText("조회합계")).toHaveTextContent("지출 105,000원");
    expect(screen.getByLabelText("조회합계")).toHaveTextContent("이체 입금 0원");
    expect(screen.getByLabelText("조회합계")).toHaveTextContent("이체 출금 0원");

    const search = screen.getByLabelText("거래내역 검색");
    fireEvent.change(search, { target: { value: "거래 21" } });
    expect(screen.getByLabelText("조회합계")).toHaveTextContent("지출 5,000원");
    fireEvent.change(search, { target: { value: "" } });

    await waitFor(() => expect(screen.getByDisplayValue("거래 1")).toBeInTheDocument());
    fireEvent.change(pageSize, { target: { value: "20" } });
    expect(screen.queryByDisplayValue("거래 21")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "거래내역 페이지 이동" }))
      .getByRole("button", { name: "2 페이지" }));

    expect(screen.getByDisplayValue("거래 21")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("거래 1")).not.toBeInTheDocument();
  }, 10_000);
});
