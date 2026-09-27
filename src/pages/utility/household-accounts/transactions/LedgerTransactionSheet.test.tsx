import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssetAccount } from "../../../../api/assetApi";
import type { LedgerCategory } from "../../../../api/ledgerApi";
import LedgerTransactionSheet from "./LedgerTransactionSheet";

const account = {
  id: 1,
  account_name: "생활비 통장",
} as AssetAccount;
const categories = [
  { id: 1, parent_id: null, category_name: "이체", depth: 1, is_active: 1 },
  { id: 2, parent_id: 1, category_name: "계좌 이동", depth: 2, is_active: 1 },
  { id: 3, parent_id: 2, category_name: "일반 이체", depth: 3, is_active: 1 },
] as LedgerCategory[];

describe("가계부 거래 PC 시트", () => {
  it("이체 출금의 음수 기호를 입력 중에도 유지한다", () => {
    render(
      <LedgerTransactionSheet
        calendarId={10}
        rows={[]}
        accounts={[account]}
        categories={categories}
        canManage
        onReload={vi.fn()}
        startDate="2026-08-01"
        endDate="2026-08-31"
        onDateRangeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ 행 추가" }));
    const transferInput = screen.getByPlaceholderText("+입금 / -출금");
    fireEvent.change(transferInput, { target: { value: "-" } });
    expect(transferInput).toHaveValue("-");

    fireEvent.change(transferInput, { target: { value: "-1234" } });
    expect(transferInput).toHaveValue("-1,234");
  });

  it("검색 결과가 없는 상태에서 추가한 신규 행을 첫 페이지에 표시한다", () => {
    render(
      <LedgerTransactionSheet
        calendarId={10}
        rows={[]}
        accounts={[account]}
        categories={categories}
        canManage
        onReload={vi.fn()}
        startDate="2026-08-01"
        endDate="2026-08-31"
        onDateRangeChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("거래내역 검색"), { target: { value: "검색되지 않는 값" } });
    expect(screen.getByText("검색 결과가 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ 행 추가" }));

    expect(screen.queryByText("검색 결과가 없습니다.")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("소분류 입력")).toBeInTheDocument();
  });
});
