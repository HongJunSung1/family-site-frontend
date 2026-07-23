import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAssetAccounts,
  getAssetAccountTypes,
  getAssetInstitutions,
  saveAssetAccount,
} from "../../../../api/assetApi";
import AssetAccountManagement from "./AssetAccountManagement";

vi.mock("../../../../api/assetApi", () => ({
  deleteAssetAccount: vi.fn(),
  getAssetAccounts: vi.fn(),
  getAssetAccountTypes: vi.fn(),
  getAssetInstitutions: vi.fn(),
  saveAssetAccount: vi.fn(),
}));

const mockedGetAccounts = vi.mocked(getAssetAccounts);
const mockedGetTypes = vi.mocked(getAssetAccountTypes);
const mockedGetInstitutions = vi.mocked(getAssetInstitutions);
const mockedSaveAccount = vi.mocked(saveAssetAccount);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetAccounts.mockResolvedValue({
    ok: true,
    currentUserId: 1,
    role: "owner",
    members: [{ user_id: 1, name: "홍길동", role: "owner" }],
    accounts: [{
      id: 21,
      calendar_id: 10,
      owner_user_id: 1,
      owner_name: "홍길동",
      institution_id: 31,
      institution_name: "국민은행",
      account_type_id: 41,
      type_name: "은행계좌",
      asset_kind: "ASSET",
      requires_institution: 1,
      allows_available: 1,
      account_name: "급여통장",
      is_available: 1,
      is_active: 1,
      display_order: 1,
      memo: "",
    }],
  });
  mockedGetInstitutions.mockResolvedValue({
    ok: true,
    canManage: true,
    institutions: [{
      id: 31,
      calendar_id: 10,
      institution_name: "국민은행",
      is_active: 1,
      display_order: 0,
    }],
  });
  mockedGetTypes.mockResolvedValue({
    ok: true,
    canManage: true,
    accountTypes: [{
      id: 41,
      calendar_id: 10,
      type_name: "은행계좌",
      asset_kind: "ASSET",
      requires_institution: 1,
      allows_available: 1,
      is_active: 1,
      display_order: 0,
    }],
  });
  mockedSaveAccount.mockResolvedValue({ ok: true, accountId: 21 });
});

describe("자산 계정 관리", () => {
  it("목록은 1부터 순서를 표시하고 수정값은 API의 0 기반 순서로 변환한다", async () => {
    render(
      <AssetAccountManagement
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<label>캘린더<select aria-label="캘린더"><option>우리 가족</option></select></label>}
      />,
    );

    const accountName = await screen.findByText("급여통장");
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
    fireEvent.click(accountName);

    const orderInput = screen.getByRole("spinbutton", { name: "순서" });
    expect(orderInput).toHaveValue(2);
    fireEvent.change(orderInput, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mockedSaveAccount).toHaveBeenCalled());
    expect(mockedSaveAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 10,
        accountName: "급여통장",
        displayOrder: 0,
      }),
      21,
    );
  });
});
