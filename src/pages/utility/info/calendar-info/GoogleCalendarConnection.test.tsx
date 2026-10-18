import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import GoogleCalendarConnection from "./GoogleCalendarConnection";
import * as api from "../../../../api/googleCalendarApi";
import { getMyCalendars } from "../../../../api/calendarApi";
import { previewCalendarSync, startCalendarSync, startFutureCalendarSync, getPendingCalendarSync } from "../../../../api/calendarSyncApi";

vi.mock("../../../../api/googleCalendarApi");
vi.mock("../../../../api/calendarSyncApi");
vi.mock("../../../../api/calendarApi", () => ({ getMyCalendars: vi.fn() }));

const ready: api.GoogleCalendarStatus = {
  ok: true, ready: true, environment: "local", redirectUri: "http://localhost:8787/api/google-calendar/callback", message: "", connection: null, mappings: [],
};
const renderPanel = (query = "") => {
  const result=render(<MemoryRouter initialEntries={[`/profile?menu=calendarSettings${query}`]}><GoogleCalendarConnection /></MemoryRouter>);
  fireEvent.click(result.container.querySelector("summary")!);
  return result;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue(ready);
  vi.mocked(api.connectGoogleCalendar).mockResolvedValue();
  vi.mocked(api.listGoogleCalendars).mockResolvedValue({ ok: true, calendars: [{ id: "my-calendar", summary: "내 일정" }, { id: "other-calendar", summary: "다른 일정" }] });
  vi.mocked(getMyCalendars).mockResolvedValue([
    { calendarId: 10, name: "가족 캘린더", role: "editor", isDefault: 1 },
    { calendarId: 30, name: "개인 캘린더", role: "owner", isDefault: 0 },
    { calendarId: 20, name: "읽기 전용", role: "viewer", isDefault: 0 },
  ]);
  vi.mocked(api.saveGoogleCalendarSelection).mockResolvedValue({ ok: true });
});

describe("구글 캘린더 연결 설정", () => {
  it("확인 대기 버튼은 방식 변경 없이 대기 항목 처리창을 연다",async()=>{
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({...ready,connection:{email:"a@example.com"},mappings:[{site_calendar_id:10,google_calendar_id:"my-calendar",google_calendar_name:"내 일정",sync_enabled:1,review_count:1,sync_mode:"future"}]});
    vi.mocked(getPendingCalendarSync).mockResolvedValue({ok:true,previewHash:"pending:h",pending:[],site:[],google:[],candidates:[],conflicts:[],state:{enabled:true,initialized:true,lastSyncedAt:null,lastError:null}});
    renderPanel();await userEvent.click(await screen.findByRole("button",{name:"가족 캘린더 확인 대기 1개 처리"}));
    expect(await screen.findByText("확인 대기 항목이 없습니다.")).toBeInTheDocument();
    expect(getPendingCalendarSync).toHaveBeenCalledWith(10);expect(previewCalendarSync).not.toHaveBeenCalled();expect(startFutureCalendarSync).not.toHaveBeenCalled();
  });
  it("동기화 관리에서 앞으로 일정만 선택하면 기존 비교 없이 전용 시작 요청을 보낸다",async()=>{
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({...ready,connection:{email:"a@example.com"},
      mappings:[{site_calendar_id:10,google_calendar_id:"my-calendar",google_calendar_name:"내 일정",sync_enabled:1}]});
    vi.mocked(startFutureCalendarSync).mockResolvedValue({ok:true,changed:0});renderPanel();
    await userEvent.click(await screen.findByRole("button",{name:"가족 캘린더 동기화 관리"}));
    expect(screen.queryByRole("button",{name:"기존 일정 확인 후 동기화"})).not.toBeInTheDocument();
    expect(screen.getByText("앞으로 저장되는 일정만 동기화가 진행됩니다.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button",{name:"확인"}));
    await waitFor(()=>expect(startFutureCalendarSync).toHaveBeenCalledWith(10));
    expect(previewCalendarSync).not.toHaveBeenCalled();expect(startCalendarSync).not.toHaveBeenCalled();
    expect(await screen.findByText("가족 캘린더: 앞으로 입력되는 일정만 양방향으로 동기화합니다.")).toBeInTheDocument();
  });
  /* Legacy review flow is temporarily disabled.
  it("시작을 취소하면 아무 작업도 하지 않고 후보가 없으면 비교 화면 없이 시작한다", async () => {
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({ ...ready, connection:{email:"a@example.com"},
      mappings:[{site_calendar_id:10,google_calendar_id:"my-calendar",google_calendar_name:"내 일정"}] });
    vi.mocked(previewCalendarSync).mockResolvedValue({ok:true,previewHash:"hash",site:[],google:[],candidates:[],conflicts:[],
      state:{enabled:false,initialized:false,lastSyncedAt:null,lastError:null}});
    renderPanel();
    const button=await screen.findByRole("button",{name:"가족 캘린더 동기화 시작"});
    await userEvent.click(button);
    expect(await screen.findByText(/동기화를 시작하시겠습니까/)).toBeInTheDocument();
    expect(previewCalendarSync).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button",{name:"취소"}));
    expect(previewCalendarSync).not.toHaveBeenCalled();
    await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button",{name:"기존 일정 확인 후 동기화"}));
    await waitFor(()=>expect(previewCalendarSync).toHaveBeenCalledWith(10));
    await waitFor(()=>expect(startCalendarSync).toHaveBeenCalledWith(10,"hash",[]));
    expect(previewCalendarSync).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region",{name:"가족 캘린더 동기화 비교"})).not.toBeInTheDocument();
  });
  it("중복 후보가 있으면 하단 영역 대신 팝업을 열고 최종 선택 후 닫는다", async () => {
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({ ...ready, connection:{email:"a@example.com"},
      mappings:[{site_calendar_id:10,google_calendar_id:"my-calendar",google_calendar_name:"내 일정"}] });
    const data={title:"병원",memo:"",location:"",start:"2026-10-30T10:00",end:"2026-10-30T11:00",allDay:false,repeat:"none",interval:1,until:"",anchor:null,monthPolicy:"clamp"};
    vi.mocked(previewCalendarSync).mockResolvedValue({ok:true,previewHash:"hash",site:[{id:"12",title:"병원",start:data.start,reason:"",data}],
      google:[{id:"g1",title:"검진",start:data.start,reason:"",data:{...data,title:"검진"}}],candidates:[{siteId:12,googleId:"g1"}],conflicts:[],
      state:{enabled:false,initialized:false,lastSyncedAt:null,lastError:null}});
    vi.mocked(startCalendarSync).mockResolvedValue({ok:true,changed:1});
    renderPanel();
    await userEvent.click(await screen.findByRole("button",{name:"가족 캘린더 동기화 시작"}));
    await userEvent.click(screen.getByRole("button",{name:"기존 일정 확인 후 동기화"}));
    const select=await screen.findByRole("combobox",{name:"병원 / 검진 연결 여부"});
    expect(select.closest('[role="dialog"]')).not.toBeNull();
    expect(previewCalendarSync).toHaveBeenCalledTimes(1);
    expect(startCalendarSync).not.toHaveBeenCalled();
    await userEvent.selectOptions(select,"link");
    await userEvent.click(screen.getByRole("button",{name:"확인한 내용으로 동기화 시작"}));
    await waitFor(()=>expect(startCalendarSync).toHaveBeenCalledWith(10,"hash",[{siteId:12,googleId:"g1",source:"site"}]));
    await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  */
  it("비교에 실패하면 동기화를 시작하거나 빈 비교 영역을 표시하지 않는다", async () => {
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({...ready,connection:{email:"a@example.com"},
      mappings:[{site_calendar_id:10,google_calendar_id:"my-calendar",google_calendar_name:"내 일정"}]});
    vi.mocked(startFutureCalendarSync).mockRejectedValue(new Error("잠시 후 다시 시도해주세요."));
    renderPanel();await userEvent.click(await screen.findByRole("button",{name:"가족 캘린더 동기화 시작"}));
    await userEvent.click(screen.getByRole("button",{name:"확인"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("잠시 후 다시 시도해주세요.");
    expect(startCalendarSync).not.toHaveBeenCalled();
    expect(screen.queryByRole("region",{name:"가족 캘린더 동기화 비교"})).not.toBeInTheDocument();
  });
  it("운영자 설정을 노출하지 않고 연결 버튼으로 승인을 시작한다", async () => {
    renderPanel();
    const button = await screen.findByRole("button", { name: "내 구글 캘린더 연결" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByLabelText(/리디렉션 URI/)).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(api.connectGoogleCalendar).toHaveBeenCalledOnce();
  });

  it("서버 설정이 부족하면 운영자 문의를 안내하고 연결은 막는다", async () => {
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({ ...ready, ready: false, message: "서버 설정이 필요합니다." });
    renderPanel();
    await screen.findByText("구글 캘린더 연결을 준비 중입니다. 사이트 운영자에게 문의해주세요.");
    expect(screen.getByRole("button", { name: "내 구글 캘린더 연결" })).toBeDisabled();
  });

  it("작성 가능한 캘린더가 두 개여도 원하는 하나만 선택해 저장한다", async () => {
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({ ...ready,
      connection: { email: "a@example.com" } });
    renderPanel("&googleCalendar=connected");
    const family = await screen.findByRole("combobox", { name: "가족 캘린더에 연결할 구글 캘린더" });
    expect(screen.queryByRole("combobox", { name: /읽기 전용/ })).not.toBeInTheDocument();
    const save = screen.getByRole("button", { name: "가족 캘린더 연결 설정 저장" });
    expect(save).toBeDisabled();
    await userEvent.selectOptions(family, "my-calendar");
    expect(screen.getByRole("combobox", { name: "개인 캘린더에 연결할 구글 캘린더" })).toHaveValue("");
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(api.saveGoogleCalendarSelection).toHaveBeenCalledWith("my-calendar", 10);
    expect(api.saveGoogleCalendarSelection).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("가족 캘린더: 연결 설정을 저장했습니다.")).toBeInTheDocument();
  });

  it("각 행을 저장할 때 다른 행의 미저장 선택을 유지하고 여러 연결을 저장한다", async () => {
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({ ...ready, connection: { email: "a@example.com" } });
    renderPanel();
    const family = await screen.findByRole("combobox", { name: "가족 캘린더에 연결할 구글 캘린더" });
    await waitFor(() => expect(family).toBeEnabled());
    const personal = screen.getByRole("combobox", { name: "개인 캘린더에 연결할 구글 캘린더" });
    await userEvent.selectOptions(family, "my-calendar");
    await userEvent.selectOptions(personal, "other-calendar");
    await userEvent.click(screen.getByRole("button", { name: "가족 캘린더 연결 설정 저장" }));
    expect(personal).toHaveValue("other-calendar");
    await userEvent.click(screen.getByRole("button", { name: "개인 캘린더 연결 설정 저장" }));
    expect(api.saveGoogleCalendarSelection).toHaveBeenNthCalledWith(1, "my-calendar", 10);
    expect(api.saveGoogleCalendarSelection).toHaveBeenNthCalledWith(2, "other-calendar", 30);
    expect(family).toHaveValue("my-calendar");
  });

  it("저장된 여러 연결을 표시하고 한 행만 연결 해제한다", async () => {
    vi.mocked(api.getGoogleCalendarStatus).mockResolvedValue({ ...ready, connection: { email: "a@example.com" }, mappings: [
      { site_calendar_id: 10, google_calendar_id: "my-calendar", google_calendar_name: "내 일정" },
      { site_calendar_id: 30, google_calendar_id: "other-calendar", google_calendar_name: "다른 일정" },
    ] });
    renderPanel();
    const family = await screen.findByRole("combobox", { name: "가족 캘린더에 연결할 구글 캘린더" });
    await waitFor(() => expect(family).toBeEnabled());
    expect(family).toHaveValue("my-calendar");
    await userEvent.selectOptions(family, "");
    await userEvent.click(screen.getByRole("button", { name: "가족 캘린더 연결 설정 저장" }));
    expect(api.saveGoogleCalendarSelection).toHaveBeenCalledWith(null, 10);
    expect(screen.getByRole("combobox", { name: "개인 캘린더에 연결할 구글 캘린더" })).toHaveValue("other-calendar");
  });

  it("승인 취소와 API 실패를 사용자에게 안내한다", async () => {
    vi.mocked(api.getGoogleCalendarStatus).mockRejectedValue(new Error("서버에 연결할 수 없습니다."));
    renderPanel("&googleCalendar=denied");
    expect(screen.getByText("구글 연결 승인을 취소했습니다.")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("서버에 연결할 수 없습니다.");
    expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeEnabled();
  });
});
