import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalendarSyncPanel from "./CalendarSyncPanel";
import * as api from "../../../../api/calendarSyncApi";
vi.mock("../../../../api/calendarSyncApi");
const event=(id:string,title:string):api.SyncEvent=>({id,title,start:"2026-10-30T10:00",reason:"",data:{title,memo:"",location:"",start:"2026-10-30T10:00",end:"2026-10-30T11:00",allDay:false,repeat:"none",interval:1,until:"",anchor:null,monthPolicy:"clamp"}});
const preview:api.SyncPreview={ok:true,previewHash:"hash",site:[event("12","병원"),event("13","가족만")],google:[event("g1","검진"),event("g2","운동")],candidates:[{siteId:12,googleId:"g1"}],conflicts:[],state:{enabled:false,initialized:false,lastSyncedAt:null,lastError:null}};
const mount=()=>render(<CalendarSyncPanel siteId={10} name="가족" onClose={vi.fn()} onChanged={vi.fn(async()=>{})}/>);
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.previewCalendarSync).mockResolvedValue(preview);vi.mocked(api.startCalendarSync).mockResolvedValue({ok:true,changed:0});});
describe("중복 의심 일정 비교",()=>{
  it("후보만 나란히 표시하고 열기만 해서는 변경하지 않는다",async()=>{
    mount();expect(await screen.findByRole("combobox",{name:"병원 / 검진 연결 여부"})).toHaveValue("");
    expect(screen.getByRole("columnheader",{name:"가족 캘린더"})).toBeInTheDocument();
    expect(screen.getByRole("columnheader",{name:"핸드폰 캘린더 (구글)"})).toBeInTheDocument();
    expect(screen.queryByText(/가족만|운동/)).not.toBeInTheDocument();expect(api.startCalendarSync).not.toHaveBeenCalled();
  });
  it("선택한 연결과 기준 내용만 전송한다",async()=>{
    mount();await userEvent.selectOptions(await screen.findByRole("combobox",{name:"병원 / 검진 연결 여부"}),"link");
    await userEvent.selectOptions(screen.getByRole("combobox",{name:"병원 / 검진 기준"}),"google");
    await userEvent.click(screen.getByRole("button",{name:"확인한 내용으로 동기화 시작"}));
    expect(api.startCalendarSync).toHaveBeenCalledWith(10,"hash",[{siteId:12,googleId:"g1",source:"google"}]);
  });
  it("서로 다른 일정 선택은 양쪽에 각각 반영하도록 요청한다",async()=>{
    mount();await userEvent.selectOptions(await screen.findByRole("combobox",{name:"병원 / 검진 연결 여부"}),"skip");
    await userEvent.click(screen.getByRole("button",{name:"확인한 내용으로 동기화 시작"}));
    expect(api.startCalendarSync).toHaveBeenCalledWith(10,"hash",[{siteId:12,googleId:null,source:"site"},{siteId:null,googleId:"g1",source:"google"}]);
  });
  it("동일한 일정의 다른 후보는 중복 연결할 수 없다",async()=>{
    vi.mocked(api.previewCalendarSync).mockResolvedValue({...preview,candidates:[...preview.candidates,{siteId:12,googleId:"g2"}]});
    mount();await userEvent.selectOptions(await screen.findByRole("combobox",{name:"병원 / 검진 연결 여부"}),"link");
    const alternate=screen.getByRole("combobox",{name:"병원 / 운동 연결 여부"});expect(alternate.querySelector('option[value="link"]')).toBeDisabled();
    await userEvent.selectOptions(screen.getByRole("combobox",{name:"병원 / 검진 연결 여부"}),"skip");
    expect(alternate.querySelector('option[value="link"]')).toBeEnabled();
  });
  it("후보가 없으면 한쪽 일정 대신 빈 상태를 표시한다",async()=>{
    vi.mocked(api.previewCalendarSync).mockResolvedValue({...preview,candidates:[]});mount();
    expect(await screen.findByText("중복이 의심되는 일정이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText(/가족만|운동/)).not.toBeInTheDocument();
  });
});
