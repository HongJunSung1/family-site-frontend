import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssetAccount } from "../../../../api/assetApi";
import * as ledgerApi from "../../../../api/ledgerApi";
import type { LedgerCategory } from "../../../../api/ledgerApi";
import LedgerTransactionSheet from "./LedgerTransactionSheet";

const account = { id: 1, account_name: "생활비 통장" } as AssetAccount;
const categories = [
  { id: 4, parent_id: null, category_name: "생활", depth: 1, is_active: 1 },
  { id: 5, parent_id: 4, category_name: "식비", depth: 2, is_active: 1 },
  { id: 6, parent_id: 5, category_name: "카페", depth: 3, is_active: 1 },
] as LedgerCategory[];
const importedRow = (description: string) => ({
  accountId: 1,
  transactionDate: "2026-09-27",
  transactionTime: "12:30",
  direction: "OUTFLOW" as const,
  amount: "5000",
  description,
  counterparty: "",
  memo: "",
  classification: "EXPENSE" as const,
  categoryId: 0,
  classificationSource: "MANUAL" as const,
  duplicateStatus: "NONE" as const,
  classificationConflict: false,
});

afterEach(() => vi.restoreAllMocks());

describe("거래내역 자동분류 갱신", () => {
  it("전체 갱신으로 미저장 엑셀 행에 최신 자동분류 결과를 적용한다", async () => {
    const classify = vi.spyOn(ledgerApi, "classifyLedgerTransactions").mockResolvedValue({
      ok: true,
      results: [{ ruleId: 1, categoryId: 6, status: "MATCHED" }],
    });
    render(
      <LedgerTransactionSheet
        calendarId={10}
        rows={[]}
        accounts={[account]}
        categories={categories}
        canManage
        onReload={vi.fn()}
        importBatch={{ id: 1, rows: [importedRow("스타벅스 강남점")] }}
        startDate="2026-09-01"
        endDate="2026-09-30"
        onDateRangeChange={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "전체 갱신" }));

    await waitFor(() => expect(classify).toHaveBeenCalledWith(10, [{ description: "스타벅스 강남점", memo: "" }]));
    expect(screen.getByPlaceholderText("소분류 입력")).toHaveValue("카페");
  });

  it("행별 갱신은 선택한 엑셀 행만 다시 분류한다", async () => {
    const classify = vi.spyOn(ledgerApi, "classifyLedgerTransactions").mockResolvedValue({
      ok: true,
      results: [{ ruleId: 1, categoryId: 6, status: "MATCHED" }],
    });
    render(
      <LedgerTransactionSheet
        calendarId={10}
        rows={[]}
        accounts={[account]}
        categories={categories}
        canManage
        onReload={vi.fn()}
        importBatch={{ id: 2, rows: [importedRow("스타벅스 강남점"), importedRow("미분류 거래")] }}
        startDate="2026-09-01"
        endDate="2026-09-30"
        onDateRangeChange={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "스타벅스 강남점 분류 갱신" }));

    await waitFor(() => expect(classify).toHaveBeenCalledWith(10, [{ description: "스타벅스 강남점", memo: "" }]));
    const categoryInputs = screen.getAllByPlaceholderText("소분류 입력");
    expect(categoryInputs[0]).toHaveValue("카페");
    expect(categoryInputs[1]).toHaveValue("");
  });

  it("완전 중복을 포함한 미저장 엑셀 행을 저장 전에 삭제한다", async () => {
    render(
      <LedgerTransactionSheet
        calendarId={10}
        rows={[]}
        accounts={[account]}
        categories={categories}
        canManage
        onReload={vi.fn()}
        importBatch={{
          id: 3,
          rows: [{ ...importedRow("키오스크 오류 결제"), duplicateStatus: "EXACT" }],
        }}
        startDate="2026-09-01"
        endDate="2026-09-30"
        onDateRangeChange={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("checkbox", { name: "거래 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("선택한 거래 1건을 삭제하시겠습니까?");
    fireEvent.click(screen.getByRole("button", { name: "예" }));

    await waitFor(() => expect(screen.queryByDisplayValue("키오스크 오류 결제")).not.toBeInTheDocument());
  });
});
