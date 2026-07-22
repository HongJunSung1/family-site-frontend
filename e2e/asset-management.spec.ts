import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [360, 768, 1440] as const;

// 자산관리 1단계 화면에 필요한 인증·알림 API 고정 응답
async function mockAssetShellApis(page: Page) {
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/auth/me"
        ? {
            ok: true,
            user: { id: 1, email: "asset@example.com", name: "테스트 사용자" },
            defaultCalendarId: 10,
            calendarRole: "owner",
          }
        : path === "/api/notifications"
          ? { ok: true, notifications: [], unreadCount: 0 }
          : { ok: true };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

// 인증 상태로 자산관리 기본 화면 진입
async function openAssetManagement(page: Page) {
  await mockAssetShellApis(page);
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.setItem("accessToken", "asset-e2e-token"));
  await page.goto("/asset-management");
  await expect(page.getByRole("heading", { name: "자산현황", exact: true })).toBeVisible();
}

// 문서 전체가 현재 화면 너비를 넘는지 확인
async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("자산관리 1단계 화면", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "desktop-chromium",
      "기준 이미지는 데스크톱 Chromium 렌더링으로 한 번만 생성",
    );
  });

  test("공통 테이블과 내부 라우팅을 화면 폭별로 표시", async ({ page }) => {
    await openAssetManagement(page);
    await expect(page.getByRole("table", { name: "자산 계정별 현황 예시" })).toBeVisible();

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      await expectNoDocumentOverflow(page);
      await expect(page).toHaveScreenshot(`asset-management-${width}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        fullPage: false,
      });
    }
  });

  test("모바일 상단 메뉴와 하단 자산관리 항목을 표시", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await openAssetManagement(page);

    await page.getByRole("button", { name: "자산현황 선택" }).click();
    await expect(page.getByRole("menuitem", { name: "월별 재산 입력" })).toBeVisible();
    await page.getByRole("button", { name: "자산현황 선택" }).click();

    await page.getByRole("button", { name: "메뉴" }).click();
    await expect(page.getByRole("link", { name: "자산관리" })).toBeVisible();
  });
});
