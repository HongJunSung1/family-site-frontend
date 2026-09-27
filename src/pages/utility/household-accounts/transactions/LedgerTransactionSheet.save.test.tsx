import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssetAccount } from "../../../../api/assetApi";
import * as ledgerApi from "../../../../api/ledgerApi";
import type { LedgerCategory, LedgerTransaction } from "../../../../api/ledgerApi";
import LedgerTransactionSheet from "./LedgerTransactionSheet";

const account = { id: 1, account_name: "생활비 통장" } as AssetAccount;
const categories = [
  { id: 1, parent_id: null, category_name: "생활", depth: 1, is_active: 1 },
  { id: 2, parent_id: 1, category_name: "식비", depth: 2, is_active: 1 },
  { id: 3, parent_id: 2, category_name: "카페", depth: 3, is_active: 1 },
] as LedgerCategory[];
const row = {
  id: 1,
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
  description: "기존 거래",
  counterparty: "",
  memo: "",
} as LedgerTransaction;

describe("거래내역 저장 상태", () => {
  it("저장 중 로딩을 표시하고 완료 후 미저장 상태를 해제한다", async () => {
    let finishSave!: (value: { ok: boolean }) => void;
    vi.spyOn(ledgerApi, "saveLedgerTransaction").mockImplementation(() => new Promise((resolve) => {
      finishSave = resolve;
    }));
    const onReload = vi.fn().mockResolvedValue(undefined);
    const onUnsavedChangesChange = vi.fn();

    render(
      <LedgerTransactionSheet
        calendarId={10}
        rows={[row]}
        accounts={[account]}
        categories={categories}
        canManage
        onReload={onReload}
        startDate="2026-09-01"
        endDate="2026-09-30"
        onDateRangeChange={vi.fn()}
        onUnsavedChangesChange={onUnsavedChangesChange}
      />,
    );

    fireEvent.change(await screen.findByDisplayValue("기존 거래"), { target: { value: "수정 거래" } });
    await waitFor(() => expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect((await screen.findAllByRole("status", { name: "거래내역 저장 중" })).length).toBeGreaterThan(0);
    finishSave({ ok: true });

    expect(await screen.findByRole("dialog")).toHaveTextContent("거래내역 저장이 완료되었습니다.");
    expect(onReload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(false));
  });
});
