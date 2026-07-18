import { expect, test, type Page } from "@playwright/test";

const meetingListItem = {
  id: 1,
  calendar_id: 10,
  calendar_name: "우리 가족",
  title: "가족 정기회의",
  meeting_type: "regular",
  meeting_at: "2026-07-18T19:00",
  location: "거실",
  status: "in_progress",
  agenda_count: 1,
  action_count: 1,
  updated_at: "2026-07-18 20:00:00",
};

const meetingDetail = {
  ok: true,
  meeting: {
    id: 1,
    calendar_id: 10,
    calendar_event_id: null,
    created_by: 1,
    title: "가족 정기회의",
    meeting_type: "regular",
    meeting_at: "2026-07-18T19:00",
    location: "거실",
    memo: "이번 달 가족 일정 정리",
    status: "in_progress",
    created_at: "2026-07-18 18:00:00",
    updated_at: "2026-07-18 20:00:00",
  },
  participants: [
    {
      user_id: 1,
      attendance_status: "present",
      name: "테스트 사용자",
      email: "test@example.com",
    },
  ],
  agendas: [
    {
      id: 100,
      meeting_id: 1,
      created_by: 1,
      title: "여름 여행 계획",
      manager_id: null,
      manager_name: null,
      priority: "normal",
      status: "waiting",
      sort_order: 1,
      attachment_count: 0,
    },
  ],
  discussions: [
    {
      id: 200,
      agenda_id: 100,
      discussion: "여행 후보지를 비교한다.",
      decision: "다음 주까지 장소를 결정한다.",
      sort_order: 1,
    },
  ],
  actionItems: [
    {
      id: 300,
      agenda_id: 100,
      discussion_id: 200,
      manager_id: 1,
      calendar_event_id: null,
      calendar_color: "#56c7a5",
      manager_name: "테스트 사용자",
      content: "숙소 후보 조사",
      due_start_date: "2026-07-19",
      due_end_date: "2026-07-21",
      status: "todo",
    },
  ],
  comments: [],
  canEdit: true,
  currentUserId: 1,
};

type MockMeetingOptions = {
  detail?: typeof meetingDetail;
  attachments?: Array<{
    id: number;
    meetingId: number;
    agendaId: number;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: number;
    uploadedAt: string;
    uploaderName: string;
  }>;
};

// 회의록 화면에서 사용하는 API를 브라우저 내부에서 고정 응답으로 대체
async function mockMeetingApis(page: Page, options: MockMeetingOptions = {}) {
  const detail = options.detail ?? meetingDetail;
  let attachments = [...(options.attachments ?? [])];

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
        calendars: [{ calendarId: 10, name: "우리 가족", role: "owner", isDefault: 1 }],
      };
    } else if (path === "/api/meetings/1") {
      body = detail;
    } else if (path === "/api/meetings") {
      body = { ok: true, meetings: [meetingListItem] };
    } else if (path === "/api/calendars/getCalendarDetail") {
      body = {
        ok: true,
        calendar: { id: 10, name: "우리 가족", owner_id: 1, created_at: "2026-01-01" },
        members: [
          {
            no: 1,
            user_id: 1,
            role: "owner",
            joined_at: "2026-01-01",
            name: "테스트 사용자",
            email: "test@example.com",
            total_count: 1,
          },
        ],
      };
    } else if (path === "/api/calendars/getMyColorPresets") {
      body = { ok: true, presets: [] };
    } else if (path === "/api/meeting-agendas/100/attachments") {
      body = { ok: true, attachments };
    } else if (path === "/api/meeting-attachments/500" && route.request().method() === "DELETE") {
      attachments = attachments.filter((attachment) => attachment.id !== 500);
      body = { ok: true };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

// 고정 인증 토큰을 저장한 뒤 테스트할 화면에 진입할 준비
async function prepareAuthenticatedPage(page: Page, options: MockMeetingOptions = {}) {
  await mockMeetingApis(page, options);
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.setItem("accessToken", "e2e-test-token"));
}

test("회의를 선택하기 전에는 상세 내용이 비어 있고 선택 후 안건을 조회", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/conference-report");

  await expect(page.getByRole("heading", { name: "회의 선택" })).toBeVisible();
  await expect(page.getByText("회의 목록에서 회의를 선택하거나 새 회의를 눌러주세요.")).toBeVisible();

  await page.getByRole("button", { name: /가족 정기회의/ }).click();
  await expect(page.getByRole("heading", { name: "가족 정기회의" })).toBeVisible();
  await expect(page.getByText("여름 여행 계획")).toBeVisible();

  await page.getByRole("button", { name: "여름 여행 계획" }).click();
  await expect(page.getByText("여행 후보지를 비교한다.")).toBeVisible();
  await expect(page.getByText("다음 주까지 장소를 결정한다.")).toBeVisible();
});

test("모바일에서 안건 수정 화면을 열고 가로 넘침 없이 표시", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "galaxy-chromium", "갤럭시 화면 전용 테스트");
  await prepareAuthenticatedPage(page);
  await page.goto("/conference-report");

  await page.getByRole("button", { name: /가족 정기회의/ }).click();
  await page.getByRole("button", { name: "수정" }).click();

  await expect(page.getByLabel("안건 제목")).toHaveValue("여름 여행 계획");
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "취소", exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("안건 수정 취소 확인에서 아니요는 유지하고 예는 원래 조회 상태로 복귀", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/conference-report");
  await page.getByRole("button", { name: /가족 정기회의/ }).click();
  await page.getByRole("button", { name: "수정", exact: true }).click();

  const titleInput = page.getByLabel("안건 제목");
  await titleInput.fill("변경 중인 안건");
  await page.getByRole("button", { name: "취소", exact: true }).click();

  const cancelDialog = page.getByRole("dialog", { name: "취소 확인" });
  await expect(cancelDialog).toBeVisible();
  await cancelDialog.getByRole("button", { name: "아니요" }).click();
  await expect(titleInput).toHaveValue("변경 중인 안건");

  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("dialog", { name: "취소 확인" }).getByRole("button", { name: "예" }).click();
  await expect(titleInput).toBeHidden();
  await expect(page.getByRole("button", { name: "여름 여행 계획" })).toBeVisible();
});

test("회의와 안건 작성자가 아닌 참석자에게 삭제 버튼을 표시하지 않음", async ({ page }) => {
  const participantDetail = {
    ...meetingDetail,
    participants: [
      ...meetingDetail.participants,
      {
        user_id: 2,
        attendance_status: "present",
        name: "다른 참석자",
        email: "member@example.com",
      },
    ],
    currentUserId: 2,
  };
  await prepareAuthenticatedPage(page, { detail: participantDetail });
  await page.goto("/conference-report");
  await page.getByRole("button", { name: /가족 정기회의/ }).click();

  const agendaHeader = page.getByRole("button", { name: "여름 여행 계획" }).locator("..");
  await expect(agendaHeader.getByRole("button", { name: "수정", exact: true })).toBeVisible();
  await expect(agendaHeader.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
});

test("첨부파일 삭제 확인 후 목록에서 제거하고 완료 안내 표시", async ({ page }) => {
  await prepareAuthenticatedPage(page, {
    attachments: [
      {
        id: 500,
        meetingId: 1,
        agendaId: 100,
        fileName: "가족계획.pdf",
        fileSize: 2048,
        mimeType: "application/pdf",
        uploadedBy: 1,
        uploadedAt: "2026-07-18T20:30:00",
        uploaderName: "테스트 사용자",
      },
    ],
  });
  await page.goto("/conference-report");
  await page.getByRole("button", { name: /가족 정기회의/ }).click();
  await page.getByRole("button", { name: "여름 여행 계획" }).click();
  await page.getByText("첨부파일", { exact: true }).click();

  const fileButton = page.getByRole("button", { name: /가족계획\.pdf/ });
  await expect(fileButton).toBeVisible();
  await fileButton.locator("..").getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("dialog", { name: "첨부파일 삭제" }).getByRole("button", { name: "예" }).click();

  await expect(page.getByText("첨부파일이 삭제되었습니다.")).toBeVisible();
  await expect(fileButton).toHaveCount(0);
});

test("회의록 상세 화면을 주요 화면 폭별 기준 이미지로 보호", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "기준 이미지는 데스크톱 Chromium에서 생성");
  await prepareAuthenticatedPage(page);
  await page.goto("/conference-report");
  await page.getByRole("button", { name: /가족 정기회의/ }).click();
  await page.getByRole("button", { name: "여름 여행 계획" }).click();
  await expect(page.getByText("여행 후보지를 비교한다.")).toBeVisible();

  for (const width of [360, 640, 768, 900, 1024, 1440] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow, `${width}px 회의록 가로 넘침`).toBeLessThanOrEqual(1);

    if ([360, 768, 900, 1440].includes(width)) {
      await expect(page).toHaveScreenshot(`conference-report-${width}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        fullPage: false,
      });
    }
  }
});
