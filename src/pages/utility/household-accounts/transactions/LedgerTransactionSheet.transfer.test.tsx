import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssetAccount } from "../../../../api/assetApi";
import * as api from "../../../../api/ledgerApi";
import LedgerTransactionSheet from "./LedgerTransactionSheet";

const categories = [
  { id: 1, parent_id: null, category_name: "이체", depth: 1, is_active: 1 },
  { id: 2, parent_id: 1, category_name: "계좌 이동", depth: 2, is_active: 1 },
  { id: 3, parent_id: 2, category_name: "일반 이체", depth: 3, is_active: 1 },
] as api.LedgerCategory[];
const row = (id: number, extra: Partial<api.LedgerTransaction> = {}) => ({
  id, calendar_id: 10, account_id: 1, account_name: "통장", owner_user_id: 1,
  owner_name: "사용자", category_id: 3, category_name: "일반 이체",
  transaction_date: "2026-09-01", transaction_time: null,
  transaction_kind: "TRANSFER", direction: id % 2 ? "OUTFLOW" : "INFLOW",
  amount: "1000", description: `거래 ${id}`, counterparty: "", memo: "", ...extra,
} as api.LedgerTransaction);
const candidate = (id: number) => ({ id } as api.LedgerTransferCandidate);
function setup(rows: api.LedgerTransaction[], canManage = true) {
  const onReload = vi.fn().mockResolvedValue(undefined);
  render(<LedgerTransactionSheet calendarId={10} rows={rows}
    accounts={[{ id: 1, account_name: "통장" } as AssetAccount]} categories={categories}
    canManage={canManage} onReload={onReload} startDate="2026-09-01" endDate="2026-09-30"
    onDateRangeChange={vi.fn()} />);
  return { onReload };
}
afterEach(() => vi.restoreAllMocks());

describe("계좌 자동 연결과 상세조회", () => {
  it("상세조회는 기본으로 닫히고 다시 열면 선택한 필터를 유지한다", () => {
    setup([row(1)]);
    const toggle = screen.getByRole("button", { name: "상세조회" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("미연결 계좌이체내역 보기")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "계좌 자동 연결" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("이벤트수익 표시")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByLabelText("미연결 계좌이체내역 보기"));
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByLabelText("미연결 계좌이체내역 보기")).toBeChecked();
  });

  it("후보가 한 건인 쌍만 한 번 연결하고 후보 없음·복수 후보·기연결·일반 거래는 건너뛴다", async () => {
    const candidates = vi.spyOn(api, "getLedgerTransferCandidates").mockImplementation(async (id) => ({
      ok: true, transactionId: id,
      candidates: ({ 1: [candidate(2)], 2: [candidate(1)], 3: [], 4: [candidate(5), candidate(6)] } as Record<number, api.LedgerTransferCandidate[]>)[id] ?? [],
    }));
    const link = vi.spyOn(api, "createLedgerTransferLink").mockResolvedValue({ ok: true, linkId: 1, linkType: "SELF" });
    const { onReload } = setup([row(1), row(2), row(3), row(4), row(7, { transfer_link_id: 2 }), row(8, { transaction_kind: "INCOME" })]);
    fireEvent.click(screen.getByRole("button", { name: "상세조회" }));
    fireEvent.click(screen.getByRole("button", { name: "계좌 자동 연결" }));
    await waitFor(() => expect(onReload).toHaveBeenCalledOnce());
    expect(candidates.mock.calls.map(([id]) => id)).toEqual([1, 2, 3, 4]);
    expect(link).toHaveBeenCalledExactlyOnceWith(1, 2);
    expect(Math.max(...candidates.mock.invocationCallOrder)).toBeLessThan(link.mock.invocationCallOrder[0]);
    expect(await screen.findByText("1쌍의 계좌이체를 자동으로 연결했습니다.")).toBeInTheDocument();
  });

  it("저장 전 수정한 거래는 조회 대상과 연결 후보에서 모두 제외한다", async () => {
    const candidates = vi.spyOn(api, "getLedgerTransferCandidates").mockResolvedValue({
      ok: true, transactionId: 1, candidates: [candidate(2)],
    });
    const link = vi.spyOn(api, "createLedgerTransferLink");
    const { onReload } = setup([row(1), row(2)]);
    fireEvent.change(screen.getByDisplayValue("거래 2"), { target: { value: "수정 중인 거래" } });
    fireEvent.click(screen.getByRole("button", { name: "상세조회" }));
    fireEvent.click(screen.getByRole("button", { name: "계좌 자동 연결" }));
    await screen.findByText(/자동으로 연결할 계좌이체가 없습니다/);
    expect(candidates).toHaveBeenCalledExactlyOnceWith(1);
    expect(link).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("수정 중인 거래")).toBeInTheDocument();
  });

  it("일부 연결 후 오류가 발생하면 연결 결과를 새로고침하고 중단을 알린다", async () => {
    vi.spyOn(api, "getLedgerTransferCandidates").mockImplementation(async (id) => ({
      ok: true, transactionId: id, candidates: [candidate(id + 10)],
    }));
    const link = vi.spyOn(api, "createLedgerTransferLink")
      .mockResolvedValueOnce({ ok: true, linkId: 1, linkType: "SELF" })
      .mockRejectedValueOnce(new Error("연결 실패"));
    const { onReload } = setup([row(1), row(3)]);
    fireEvent.click(screen.getByRole("button", { name: "상세조회" }));
    fireEvent.click(screen.getByRole("button", { name: "계좌 자동 연결" }));
    await screen.findByText(/1쌍 연결 후 중단했습니다/);
    expect(link).toHaveBeenCalledTimes(2);
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("관리 권한이 없으면 자동 연결 버튼을 비활성화한다", () => {
    setup([row(1)], false);
    fireEvent.click(screen.getByRole("button", { name: "상세조회" }));
    expect(screen.getByRole("button", { name: "계좌 자동 연결" })).toBeDisabled();
  });
});
