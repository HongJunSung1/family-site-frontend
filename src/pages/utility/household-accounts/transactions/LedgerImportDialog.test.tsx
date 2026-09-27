import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetAccount } from "../../../../api/assetApi";
import { getLedgerImportProfiles } from "../../../../api/ledgerApi";
import LedgerImportDialog from "./LedgerImportDialog";

vi.mock("../../../../api/ledgerApi", () => ({
  getLedgerImportProfiles: vi.fn(),
  checkLedgerTransactionDuplicates: vi.fn(),
  classifyLedgerTransactions: vi.fn(),
}));

const account = (id: number, ownerUserId: number, name: string) => ({
  id,
  owner_user_id: ownerUserId,
  institution_name: "테스트은행",
  account_name: name,
} as AssetAccount);

describe("엑셀 거래 가져오기 계정 선택", () => {
  beforeEach(() => {
    vi.mocked(getLedgerImportProfiles).mockResolvedValue({
      ok: true,
      canManage: true,
      profiles: [{ id: 1, profile_name: "테스트 양식", institution_name: "테스트은행", is_active: 1 }],
    } as Awaited<ReturnType<typeof getLedgerImportProfiles>>);
  });

  it("전달된 회원 계정만 표시하고 회원 계정 목록이 바뀌면 첫 계정으로 초기화한다", async () => {
    const firstOwnerAccount = account(11, 1, "첫 번째 통장");
    const secondOwnerAccount = account(22, 2, "두 번째 통장");
    const { rerender } = render(
      <LedgerImportDialog open calendarId={10} accounts={[firstOwnerAccount]} onClose={vi.fn()} onParsed={vi.fn()} />,
    );

    const accountSelect = await screen.findByLabelText("계정");
    await waitFor(() => expect(accountSelect).toHaveValue("11"));
    expect(screen.getByRole("option", { name: "테스트은행 · 첫 번째 통장" })).toBeInTheDocument();

    rerender(<LedgerImportDialog open calendarId={10} accounts={[secondOwnerAccount]} onClose={vi.fn()} onParsed={vi.fn()} />);

    await waitFor(() => expect(accountSelect).toHaveValue("22"));
    expect(screen.queryByRole("option", { name: "테스트은행 · 첫 번째 통장" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "테스트은행 · 두 번째 통장" })).toBeInTheDocument();
  });
});
