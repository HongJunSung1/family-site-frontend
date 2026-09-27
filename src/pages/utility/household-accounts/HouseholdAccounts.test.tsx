import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyCalendars } from "../../../api/calendarApi";
import HouseholdAccounts from "./HouseholdAccounts";

vi.mock("../../../api/calendarApi", () => ({ getMyCalendars: vi.fn() }));
vi.mock("../../../common/mobile-header", () => ({
  useMobileHeader: () => ({ setConfig: vi.fn(), resetConfig: vi.fn() }),
}));
vi.mock("./overview/LedgerOverview", () => ({ default: () => <div>현황 화면</div> }));
vi.mock("./transactions/LedgerTransactions", async () => {
  const React = await import("react");
  const MockLedgerTransactions = () => {
    const [value, setValue] = React.useState("");
    return <label>거래 화면 상태<input aria-label="거래 화면 상태" value={value} onChange={(event) => setValue(event.target.value)} /></label>;
  };
  return { default: MockLedgerTransactions };
});
vi.mock("./settings/LedgerAccounts", () => ({ default: () => <div>계정 화면</div> }));
vi.mock("./settings/LedgerCategories", () => ({ default: () => <div>분류 화면</div> }));
vi.mock("./settings/LedgerImportProfiles", () => ({ default: () => <div>양식 화면</div> }));

describe("가계부 내부 화면 유지", () => {
  beforeEach(() => {
    vi.mocked(getMyCalendars).mockResolvedValue([{ calendarId: 10, name: "테스트 캘린더", role: "owner", isDefault: 1 }]);
  });

  it("다른 가계부 화면을 다녀와도 기존 거래 화면 상태를 유지한다", async () => {
    render(
      <MemoryRouter initialEntries={["/household-accounts/transactions"]}>
        <Routes><Route path="/household-accounts/*" element={<HouseholdAccounts />} /></Routes>
      </MemoryRouter>,
    );

    const stateInput = await screen.findByLabelText("거래 화면 상태");
    fireEvent.change(stateInput, { target: { value: "기존 검색 상태" } });
    fireEvent.click(screen.getByRole("link", { name: "가계부 현황" }));
    await screen.findByText("현황 화면");
    fireEvent.click(screen.getByRole("link", { name: "거래내역" }));

    await waitFor(() => expect(screen.getByLabelText("거래 화면 상태")).toHaveValue("기존 검색 상태"));
  });
});
