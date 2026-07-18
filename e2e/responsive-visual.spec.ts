import { expect, test, type Page } from "@playwright/test";

const CALENDAR_VIEWPORTS = [360, 412, 640, 768, 900, 1024, 1440] as const;
const SCREENSHOT_VIEWPORTS = [360, 640, 768, 900, 1440] as const;
const VIEWPORT_HEIGHT = 900;

// 캘린더 반응형 테스트에 필요한 API를 고정 응답으로 대체
async function mockCalendarApis(page: Page) {
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = { ok: true };

    if (path === "/api/auth/me") {
      body = {
        ok: true,
        user: { id: 1, email: "test@example.com", name: "테스트 사용자" },
        defaultCalendarId: 10,
        calendarRole: "owner",
      };
    } else if (path === "/api/auth/myCalendar") {
      body = {
        ok: true,
        calendars: [
          { calendarId: 10, name: "우리 가족", role: "owner", isDefault: 1 },
          { calendarId: 11, name: "가족 일정 공유", role: "member", isDefault: 0 },
        ],
      };
    } else if (path === "/api/calendar/events") {
      body = {
        ok: true,
        events: [
          {
            id: 1,
            title: "가족 저녁 식사",
            start_at: "2026-07-18T18:00:00",
            end_at: "2026-07-18T20:00:00",
            all_day: 0,
            memo: "주말 가족 식사",
            color: "#5c7cfa",
            created_by: 1,
            created_by_name: "테스트 사용자",
            repeat_type: "none",
          },
          {
            id: 2,
            title: "여름 여행 준비",
            start_at: "2026-07-18T00:00:00",
            end_at: "2026-07-21T23:59:00",
            all_day: 1,
            memo: "준비물 확인",
            color: "#56c7a5",
            created_by: 1,
            created_by_name: "테스트 사용자",
            repeat_type: "none",
          },
          {
            id: 3,
            title: "아이 운동회",
            start_at: "2026-07-18T10:00:00",
            end_at: "2026-07-18T12:00:00",
            all_day: 0,
            memo: "운동장 집합",
            color: "#adb5bd",
            created_by: 1,
            created_by_name: "테스트 사용자",
            repeat_type: "none",
          },
        ],
        exceptions: [],
        overrides: [],
      };
    } else if (path === "/api/calendars/getMyColorPresets") {
      body = { ok: true, presets: [] };
    } else if (path === "/api/holidays") {
      body = {
        ok: true,
        holidays: [{ date: "2026-07-17", name: "제헌절" }],
      };
    } else if (path === "/api/notifications") {
      body = { ok: true, notifications: [], unreadCount: 0 };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

// 고정 날짜와 인증 상태로 캘린더 화면 진입
async function openCalendar(page: Page) {
  await page.clock.setFixedTime(new Date("2026-07-18T12:00:00+09:00"));
  await mockCalendarApis(page);
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.setItem("accessToken", "responsive-e2e-token"));
  await page.goto("/home");
  await expect(page.locator(".fc-daygrid")).toBeVisible();
  await expect(page.getByRole("status", { name: "일정 로딩 중" })).toBeHidden({ timeout: 5_000 });
}

// 문서와 주요 조작 요소가 현재 화면 너비 밖으로 벗어나는지 검사
async function expectNoHorizontalLayoutEscape(page: Page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflow = document.documentElement.scrollWidth - viewportWidth;
    const escapedControls = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, a, input, textarea, select, [role='dialog'], [role='menu']",
      ),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
      }))
      .filter(({ rect }) => rect.left < -1 || rect.right > viewportWidth + 1)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        name: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40) || "",
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));

    return { documentOverflow, escapedControls };
  });

  expect(result.documentOverflow, `문서 가로 넘침: ${result.documentOverflow}px`).toBeLessThanOrEqual(1);
  expect(result.escapedControls, `화면 밖 조작 요소: ${JSON.stringify(result.escapedControls)}`).toEqual([]);
}

test.describe("현재 UI 반응형 보호", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "desktop-chromium",
      "기준 이미지는 데스크톱 Chromium 렌더링으로 한 번만 생성",
    );
  });

  test("주요 화면 폭에서 캘린더가 가로로 넘치지 않음", async ({ page }) => {
    await openCalendar(page);

    for (const width of CALENDAR_VIEWPORTS) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.waitForTimeout(150);
      await expectNoHorizontalLayoutEscape(page);
    }
  });

  test("현재 캘린더 UI를 화면 폭별 기준 이미지로 보호", async ({ page }) => {
    await openCalendar(page);

    for (const width of SCREENSHOT_VIEWPORTS) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot(`calendar-${width}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        fullPage: false,
      });
    }
  });

  test("PC 다크모드 상단 아이콘 색상을 기준 이미지로 보호", async ({ page }) => {
    await openCalendar(page);
    await page.setViewportSize({ width: 1440, height: VIEWPORT_HEIGHT });
    await page.getByRole("switch", { name: "다크모드로 전환" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page).toHaveScreenshot("calendar-dark-1440.png", {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      fullPage: false,
    });
  });

  test("현재 로그인 UI를 모바일과 PC 기준 이미지로 보호", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

    for (const width of [360, 768, 1440] as const) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.waitForTimeout(100);
      await expectNoHorizontalLayoutEscape(page);
      await expect(page).toHaveScreenshot(`login-${width}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        fullPage: false,
      });
    }
  });
});
