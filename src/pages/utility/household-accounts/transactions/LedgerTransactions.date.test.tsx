import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import * as assetApi from "../../../../api/assetApi";
import * as ledgerApi from "../../../../api/ledgerApi";
import LedgerTransactions from "./LedgerTransactions";

vi.mock("./LedgerImportDialog", () => ({ default: () => null }));
vi.mock("../settings/LedgerCategories", () => ({ default: () => null }));
vi.mock("./LedgerTransactionSheet", () => ({
  default: ({ rows, onDateRangeChange }: {
    rows: ledgerApi.LedgerTransaction[];
    onDateRangeChange: (start: string, end: string) => void;
  }) => <>
    <div data-testid="rows">{rows.length}</div>
    <button onClick={() => onDateRangeChange("2026-09-01", "2026-09-30")}>정상 기간</button>
    <button onClick={() => onDateRangeChange("2026-10-01", "2026-09-30")}>역전 기간</button>
  </>,
}));

it("역전 기간은 조회 요청 없이 목록을 비우고 이전 응답도 무시한다", async () => {
  vi.spyOn(assetApi, "getAssetAccounts").mockResolvedValue({
    ok: true, accounts: [], members: [{ user_id: 0, name: "사용자", role: "owner" }],
    currentUserId: 0, role: "owner",
  });
  vi.spyOn(ledgerApi, "getLedgerCategories").mockResolvedValue({ ok: true, categories: [
    { id: 3, parent_id: null, category_name: "기타", depth: 3, is_active: 1 } as ledgerApi.LedgerCategory,
  ], canManage: false });
  const data = { ok: true, transactions: [{
    id: 1, transaction_date: "2026-09-01", category_id: 3, description: "거래",
    amount: "1000", transaction_kind: "INCOME", direction: "INFLOW",
  } as ledgerApi.LedgerTransaction], canManage: false };
  const query = vi.spyOn(ledgerApi, "getLedgerTransactions").mockResolvedValue(data);
  render(<LedgerTransactions calendarId={10} calendarName="가족" calendarControl={null} />);
  await waitFor(() => expect(screen.getByTestId("rows")).toHaveTextContent("1"));

  let resolvePending!: (value: typeof data) => void;
  query.mockImplementationOnce(() => new Promise((resolve) => { resolvePending = resolve; }));
  fireEvent.click(screen.getByText("정상 기간"));
  await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByText("역전 기간"));
  await waitFor(() => expect(screen.getByTestId("rows")).toHaveTextContent("0"));
  await act(async () => { resolvePending(data); });
  expect(query).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("rows")).toHaveTextContent("0");
  expect(screen.queryByText("조회 실패")).not.toBeInTheDocument();
});
