import { expect, test, type Page, type Route } from "@playwright/test";

const VIEWPORTS = [360, 768, 1440] as const;

const members = [
  { user_id: 1, name: "홍길동", role: "owner" },
  { user_id: 2, name: "김가족", role: "editor" },
];
const institutions = [
  { id: 31, calendar_id: 10, institution_name: "국민은행", is_active: 1, display_order: 0 },
];
const accountTypes = [
  {
    id: 41,
    calendar_id: 10,
    type_name: "은행계좌",
    asset_kind: "ASSET",
    requires_institution: 1,
    allows_available: 1,
    is_active: 1,
    display_order: 0,
  },
  {
    id: 42,
    calendar_id: 10,
    type_name: "대출",
    asset_kind: "LIABILITY",
    requires_institution: 0,
    allows_available: 0,
    is_active: 1,
    display_order: 1,
  },
];
const accounts = [
  {
    id: 51,
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
    display_order: 0,
    memo: "생활비 계정",
  },
  {
    id: 52,
    calendar_id: 10,
    owner_user_id: 1,
    owner_name: "홍길동",
    institution_id: null,
    institution_name: null,
    account_type_id: 42,
    type_name: "대출",
    asset_kind: "LIABILITY",
    requires_institution: 0,
    allows_available: 0,
    account_name: "주택대출",
    is_available: null,
    is_active: 1,
    display_order: 1,
    memo: "",
  },
];

async function fulfill(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

// 현재 자산관리 네 화면이 사용하는 API를 고정해 기능과 시각 회귀를 재현
async function mockAssetApis(page: Page) {
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/auth/me") {
      return fulfill(route, {
        ok: true,
        user: { id: 1, email: "asset@example.com", name: "홍길동" },
        defaultCalendarId: 10,
        calendarRole: "owner",
      });
    }
    if (path === "/api/auth/myCalendar") {
      return fulfill(route, {
        ok: true,
        calendars: [{ calendarId: 10, name: "우리 가족", role: "owner", isDefault: 1 }],
      });
    }
    if (path === "/api/notifications") {
      return fulfill(route, { ok: true, notifications: [], unreadCount: 0 });
    }
    if (path === "/api/assets/institutions") {
      return fulfill(route, { ok: true, institutions, canManage: true });
    }
    if (path === "/api/assets/account-types") {
      return fulfill(route, { ok: true, accountTypes, canManage: true });
    }
    if (path === "/api/assets/accounts") {
      return fulfill(route, {
        ok: true,
        accounts,
        members,
        currentUserId: 1,
        role: "owner",
      });
    }
    if (path === "/api/assets/monthly-input") {
      return fulfill(route, {
        ok: true,
        canEdit: true,
        owner: { userId: Number(url.searchParams.get("ownerUserId")), name: "홍길동" },
        lastSavedAt: "2026-07-20T19:30:00",
        accounts: [
          {
            id: 51,
            institutionName: "국민은행",
            typeName: "은행계좌",
            assetKind: "ASSET",
            isAvailable: 1,
            accountName: "급여통장",
            balance: "1500000",
            previousBalance: "1200000",
            updatedAt: "2026-07-20T19:30:00",
          },
          {
            id: 52,
            institutionName: null,
            typeName: "대출",
            assetKind: "LIABILITY",
            isAvailable: null,
            accountName: "주택대출",
            balance: "500000",
            previousBalance: "600000",
            updatedAt: "2026-07-20T19:30:00",
          },
        ],
      });
    }
    if (path === "/api/assets/monthly-balances/save") {
      return fulfill(route, { ok: true, savedAt: "2026-07-23T15:00:00" });
    }
    if (path === "/api/assets/summary") {
      return fulfill(route, {
        ok: true,
        yearMonth: "2026-07",
        totals: { assets: "2750000", liabilities: "500000", netAssets: "2250000", available: "2750000" },
        previousTotals: { assets: "2000000", liabilities: "600000", netAssets: "1400000", available: "2000000" },
        change: { assets: "750000", liabilities: "-100000", netAssets: "850000", available: "750000" },
        missingCount: 1,
        members: [
          { userId: 1, name: "홍길동", assets: "1500000", liabilities: "500000", netAssets: "1000000", available: "1500000", missing: 0 },
          { userId: 2, name: "김가족", assets: "1250000", liabilities: "0", netAssets: "1250000", available: "1250000", missing: 1 },
        ],
        accounts: [
          {
            id: 51,
            ownerUserId: 1,
            ownerName: "홍길동",
            institutionName: "국민은행",
            accountName: "급여통장",
            typeName: "은행계좌",
            assetKind: "ASSET",
            isAvailable: 1,
            isActive: 1,
            balance: "1500000",
            previousBalance: "1200000",
          },
          {
            id: 53,
            ownerUserId: 2,
            ownerName: "김가족",
            institutionName: "증권사",
            accountName: "투자계좌",
            typeName: "증권계좌",
            assetKind: "ASSET",
            isAvailable: 1,
            isActive: 1,
            balance: null,
            previousBalance: "1250000",
          },
        ],
      });
    }
    if (path === "/api/assets/history") {
      return fulfill(route, {
        ok: true,
        history: [
          { month: "2025-08", assets: "0", liabilities: "0", netAssets: "0", available: "0", entered: 0 },
          { month: "2025-09", assets: "0", liabilities: "0", netAssets: "0", available: "0", entered: 0 },
          { month: "2025-10", assets: "1500000", liabilities: "700000", netAssets: "800000", available: "1200000", entered: 1 },
          { month: "2025-11", assets: "1650000", liabilities: "680000", netAssets: "970000", available: "1300000", entered: 1 },
          { month: "2025-12", assets: "0", liabilities: "0", netAssets: "0", available: "0", entered: 0 },
          { month: "2026-01", assets: "1900000", liabilities: "650000", netAssets: "1250000", available: "1500000", entered: 1 },
          { month: "2026-02", assets: "2050000", liabilities: "620000", netAssets: "1430000", available: "1650000", entered: 1 },
          { month: "2026-03", assets: "2200000", liabilities: "600000", netAssets: "1600000", available: "1800000", entered: 1 },
          { month: "2026-04", assets: "2300000", liabilities: "580000", netAssets: "1720000", available: "1950000", entered: 1 },
          { month: "2026-05", assets: "2450000", liabilities: "550000", netAssets: "1900000", available: "2200000", entered: 1 },
          { month: "2026-06", assets: "2550000", liabilities: "600000", netAssets: "1950000", available: "2300000", entered: 1 },
          { month: "2026-07", assets: "2750000", liabilities: "500000", netAssets: "2250000", available: "2750000", entered: 1 },
        ],
      });
    }

    return fulfill(route, { ok: true });
  });
}

async function openAssetManagement(page: Page, path = "/asset-management/overview") {
  await mockAssetApis(page);
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.setItem("accessToken", "asset-e2e-token"));
  await page.goto(path);
  await expect(page.getByRole("heading", { name: /자산현황|월별 자산 입력|자산 계정 관리|기준 정보 관리/ })).toBeVisible();
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("자산관리 현재 화면", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "desktop-chromium",
      "기준 이미지와 기능 흐름은 데스크톱 Chromium에서 화면 폭을 직접 변경해 한 번 검증",
    );
  });

  test("자산현황을 360·768·1440 화면에서 표시하고 미입력 상세를 연다", async ({ page }) => {
    await openAssetManagement(page);
    await expect(page.getByText("최근 12개월 자산 추이")).toBeVisible();

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoDocumentOverflow(page);
      await expect(page).toHaveScreenshot(`asset-overview-${width}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        fullPage: false,
      });
    }

    await page.getByText(/입력되지 않은 계정이 1개/).click();
    await expect(page.getByText(/투자계좌/)).toBeVisible();
    await expect(page.getByText(/2026년 7월/)).toBeVisible();
  });

  test("월별 잔액을 수정해 선택 구성원과 함께 저장한다", async ({ page }) => {
    await openAssetManagement(page, "/asset-management/monthly");
    const balanceInput = page.getByRole("textbox", { name: "급여통장 잔액" });
    await expect(balanceInput).toHaveValue("1,500,000");
    await balanceInput.fill("1800000");

    const saveRequest = page.waitForRequest((request) => (
      request.url().includes("/api/assets/monthly-balances/save")
      && request.method() === "POST"
    ));
    await page.getByRole("button", { name: "저장" }).click();
    const request = await saveRequest;
    expect(request.postDataJSON()).toMatchObject({
      calendarId: 10,
      ownerUserId: 1,
      balances: [
        { accountId: 51, balance: "1800000" },
        { accountId: 52, balance: "500000" },
      ],
    });
    await expect(page.getByText("저장했습니다.")).toBeVisible();
  });

  test("자산 계정과 기준정보에서 숫자 순서 편집 화면을 연다", async ({ page }) => {
    await openAssetManagement(page, "/asset-management/accounts");
    await page.getByText("급여통장", { exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: "순서" })).toHaveValue("1");

    await page.goto("/asset-management/reference");
    await expect(page.getByRole("heading", { name: "기준 정보 관리" })).toBeVisible();
    await page.getByText("국민은행", { exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: "순서" })).toHaveValue("1");
  });

  test("모바일 메뉴에서 모든 자산관리 화면으로 이동한다", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await openAssetManagement(page);
    await page.getByRole("button", { name: "자산현황 선택" }).click();
    await expect(page.getByRole("menuitem", { name: "월별 재산 입력" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "환경설정" })).toBeVisible();
  });
});
