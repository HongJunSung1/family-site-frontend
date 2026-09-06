import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAssetAccounts,
  getMonthlyAssetInput,
  saveMonthlyAssetBalances,
} from "../../../../api/assetApi";
import MonthlyAssetInput from "./MonthlyAssetInput";
import styles from "../AssetManagement.module.css";

vi.mock("../../../../api/assetApi", () => ({
  getAssetAccounts: vi.fn(),
  getMonthlyAssetInput: vi.fn(),
  saveMonthlyAssetBalances: vi.fn(),
}));

const mockedGetAccounts = vi.mocked(getAssetAccounts);
const mockedGetMonthlyInput = vi.mocked(getMonthlyAssetInput);
const mockedSaveBalances = vi.mocked(saveMonthlyAssetBalances);

const accounts = [
  {
    id: 11,
    institutionName: "국민은행",
    typeName: "은행계좌",
    assetKind: "ASSET" as const,
    isAvailable: 1,
    accountName: "급여통장",
    memo: "생활비와 공과금 결제 계정",
    balance: "1200000",
    previousBalance: "1000000",
    updatedAt: "2026-07-01T10:00:00",
  },
  {
    id: 12,
    institutionName: "금융기관 없음",
    typeName: "대출",
    assetKind: "LIABILITY" as const,
    isAvailable: null,
    accountName: "주택대출",
    memo: "",
    balance: "300000",
    previousBalance: "400000",
    updatedAt: "2026-07-01T10:00:00",
  },
];

function renderScreen() {
  return render(
    <MemoryRouter>
      <MonthlyAssetInput
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<label>캘린더<select aria-label="캘린더"><option>우리 가족</option></select></label>}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetAccounts.mockResolvedValue({
    ok: true,
    accounts: [],
    members: [
      { user_id: 1, name: "홍길동", role: "owner" },
      { user_id: 2, name: "김가족", role: "editor" },
    ],
    currentUserId: 1,
    role: "owner",
  });
  mockedGetMonthlyInput.mockResolvedValue({
    ok: true,
    accounts,
    lastSavedAt: "2026-07-01T10:00:00",
    canEdit: true,
    owner: { userId: 1, name: "홍길동" },
  });
});

describe("월별 자산 입력", () => {
  it("입력값으로 자산·부채·순자산·가용재산과 전월 대비를 계산한다", async () => {
    renderScreen();

    expect(await screen.findByRole("table", { name: "월별 자산 입력" })).toBeInTheDocument();
    expect(screen.getAllByText("1,200,000원").length).toBeGreaterThan(0);
    expect(screen.getAllByText("300,000원").length).toBeGreaterThan(0);
    expect(screen.getByText("900,000원")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "급여통장 메모" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip", { hidden: true }))
      .toHaveTextContent("생활비와 공과금 결제 계정");
    expect(screen.queryByRole("button", { name: "주택대출 메모" })).not.toBeInTheDocument();
    expect(screen.getAllByText("+200,000원")[0]).toHaveClass(styles.changeIncrease);
    expect(screen.getAllByText("-100,000원")[0]).toHaveClass(styles.changeDecrease);

    fireEvent.change(screen.getByRole("textbox", { name: "급여통장 잔액" }), {
      target: { value: "1,500,000" },
    });

    expect(screen.getAllByText("1,500,000원").length).toBeGreaterThan(0);
    expect(screen.getByText("1,200,000원")).toBeInTheDocument();
    expect(screen.getAllByText("+500,000원")[0]).toHaveClass(styles.changeIncrease);
  });

  it("선택 구성원의 빈 값은 null로, 0원은 문자열 0으로 일괄 저장한다", async () => {
    mockedSaveBalances.mockResolvedValue({
      ok: true,
      savedAt: "2026-07-23T15:00:00",
    });
    renderScreen();
    await screen.findByRole("table", { name: "월별 자산 입력" });

    fireEvent.change(screen.getByRole("textbox", { name: "급여통장 잔액" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "주택대출 잔액" }), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mockedSaveBalances).toHaveBeenCalled());
    expect(mockedSaveBalances).toHaveBeenCalledWith(
      10,
      1,
      expect.any(String),
      [
        { accountId: 11, balance: null },
        { accountId: 12, balance: "0" },
      ],
    );
    expect(await screen.findByText("저장했습니다.")).toBeInTheDocument();
  });

  it("계정 계산기 결과를 이번 달 잔액에 적용한다", async () => {
    renderScreen();
    await screen.findByRole("table", { name: "월별 자산 입력" });

    fireEvent.click(screen.getByRole("button", { name: "급여통장 계산기 열기" }));
    expect(await screen.findByRole("heading", { name: "잔액 계산기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "C" }));
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "=" }));
    expect(screen.getByText("10 + 2 =")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^적용$/ }));

    expect(screen.getByRole("textbox", { name: "급여통장 잔액" })).toHaveValue("12");
  });

  it("계산기를 숫자패드와 키보드로 조작한다", async () => {
    renderScreen();
    await screen.findByRole("table", { name: "월별 자산 입력" });
    fireEvent.click(screen.getByRole("button", { name: "급여통장 계산기 열기" }));

    const calculator = await screen.findByRole("dialog");
    fireEvent.keyDown(calculator, { key: "Delete", code: "NumpadDecimal" });
    fireEvent.keyDown(calculator, { key: "2", code: "Numpad2" });
    fireEvent.keyDown(calculator, { key: "5", code: "Numpad5" });
    fireEvent.keyDown(calculator, { key: "+", code: "NumpadAdd" });
    fireEvent.keyDown(calculator, { key: "5", code: "Numpad5" });
    fireEvent.keyDown(calculator, { key: "Enter", code: "NumpadEnter" });
    fireEvent.click(screen.getByRole("button", { name: /^적용$/ }));

    expect(screen.getByRole("textbox", { name: "급여통장 잔액" })).toHaveValue("30");
  });
});
