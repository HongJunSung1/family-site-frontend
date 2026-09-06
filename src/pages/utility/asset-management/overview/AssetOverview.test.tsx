import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssetHistory, getAssetSummary } from "../../../../api/assetApi";
import AssetOverview from "./AssetOverview";
import styles from "../AssetManagement.module.css";

vi.mock("@mui/material/useMediaQuery", () => ({
  default: () => false,
}));
vi.mock("@mui/x-charts/LineChart", () => ({
  LineChart: () => <div role="img" aria-label="최근 12개월 자산 추이 그래프" />,
}));
vi.mock("../../../../api/assetApi", () => ({
  getAssetHistory: vi.fn(),
  getAssetSummary: vi.fn(),
}));

const mockedGetSummary = vi.mocked(getAssetSummary);
const mockedGetHistory = vi.mocked(getAssetHistory);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetSummary.mockResolvedValue({
    ok: true,
    yearMonth: "2026-07",
    totals: { assets: "1500000", liabilities: "500000", netAssets: "1000000", available: "1500000" },
    previousTotals: { assets: "1200000", liabilities: "600000", netAssets: "600000", available: "1200000" },
    change: { assets: "300000", liabilities: "-100000", netAssets: "400000", available: "300000" },
    missingCount: 1,
    members: [{
      userId: 1,
      name: "홍길동",
      assets: "1500000",
      liabilities: "500000",
      netAssets: "1000000",
      available: "1500000",
      missing: 1,
    }],
    accounts: [{
      id: 51,
      ownerUserId: 1,
      ownerName: "홍길동",
      institutionName: "국민은행",
      accountName: "급여통장",
      typeName: "은행계좌",
      assetKind: "ASSET",
      isAvailable: 1,
      isActive: 1,
      balance: null,
      previousBalance: "1200000",
    }],
  });
  mockedGetHistory.mockResolvedValue({
    ok: true,
    history: [{
      month: "2026-07",
      assets: "1500000",
      liabilities: "500000",
      netAssets: "1000000",
      available: "1500000",
      entered: 1,
    }],
  });
});

describe("자산현황", () => {
  it("요약 합계와 미입력 계정의 기준 연월을 펼쳐 표시한다", async () => {
    render(
      <AssetOverview
        calendarId={10}
        calendarName="우리 가족"
        calendarControl={<label>캘린더<select aria-label="캘린더"><option>우리 가족</option></select></label>}
      />,
    );

    fireEvent.change(screen.getByLabelText("기준 월"), { target: { value: "2026-07" } });

    expect((await screen.findAllByText("1,500,000원")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,000,000원").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+300,000원")[0]).toHaveClass(styles.changeIncrease);
    expect(screen.getByText("-100,000원")).toHaveClass(styles.changeDecrease);
    expect(screen.getAllByText("전월 대비")[0]).not.toHaveClass(styles.changeIncrease);
    expect(screen.getAllByText("전월 대비")[0]).not.toHaveClass(styles.changeDecrease);
    expect(screen.getByRole("img", { name: "최근 12개월 자산 추이 그래프" })).toBeInTheDocument();

    fireEvent.click(screen.getByText(/입력되지 않은 계정이 1개/));
    expect(screen.getAllByText(/급여통장/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2026년 7월/)).toBeInTheDocument();
  });
});
