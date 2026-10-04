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
