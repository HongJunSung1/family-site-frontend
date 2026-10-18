import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalendarSyncPending from "./CalendarSyncPending";
import * as api from "../../../../api/calendarSyncApi";
vi.mock("../../../../api/calendarSyncApi");
const item:api.SyncEvent={id:"1",title:"시간 오류",start:"2026-10-11T09:00",reason:"종료 시각을 확인해주세요.",data:null};
const data:api.PendingSync={ok:true,previewHash:"pending:hash",pending:[{linkId:"link",siteId:1,googleId:null,site:item,google:null,reason:item.reason}],site:[item],google:[],candidates:[],conflicts:[],state:{enabled:true,initialized:true,lastError:null,lastSyncedAt:null}};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.getPendingCalendarSync).mockResolvedValue(data);vi.mocked(api.resolveCalendarSync).mockResolvedValue({ok:true,changed:0,reviewCount:0});});
it("대기 사유를 표시하고 지원하지 않는 일정은 제외할 수 있다",async()=>{
  render(<CalendarSyncPending siteId={10} name="가족" onClose={vi.fn()} onChanged={vi.fn(async()=>{})}/>);
  expect(await screen.findByText(item.reason)).toBeInTheDocument();expect(api.resolveCalendarSync).not.toHaveBeenCalled();
  const select=screen.getByRole("combobox",{name:"시간 오류 대기 처리"});expect(select.querySelector('option[value="site"]')).toBeDisabled();
  await userEvent.selectOptions(select,"ignore");await userEvent.click(screen.getByRole("button",{name:"선택한 항목 처리"}));
  await waitFor(()=>expect(api.resolveCalendarSync).toHaveBeenCalledWith(10,"pending:hash",[{linkId:"link",siteId:1,googleId:null,source:"ignore"}]));
  expect(api.startCalendarSync).not.toHaveBeenCalled();expect(api.startFutureCalendarSync).not.toHaveBeenCalled();
});
it("대기 항목이 없으면 처리 버튼을 비활성화한다",async()=>{
  vi.mocked(api.getPendingCalendarSync).mockResolvedValue({...data,pending:[],site:[]});
  render(<CalendarSyncPending siteId={10} name="가족" onClose={vi.fn()} onChanged={vi.fn(async()=>{})}/>);
  expect(await screen.findByText("확인 대기 항목이 없습니다.")).toBeInTheDocument();expect(screen.getByRole("button",{name:"선택한 항목 처리"})).toBeDisabled();
});
it("중복이 아닌 두 일정은 각각 반영하도록 처리한다",async()=>{
  const content={title:"검진",memo:"",location:"",start:"2026-10-11T09:00",end:"2026-10-11T10:00",allDay:false,repeat:"none",interval:1,until:"",anchor:null,monthPolicy:"clamp"};
  const site={...item,title:"검진",reason:"",data:content};const google={...site,id:"g"};
  vi.mocked(api.getPendingCalendarSync).mockResolvedValue({...data,site:[site],google:[google],candidates:[{siteId:1,googleId:"g"}],pending:[{linkId:"s",siteId:1,googleId:null,site,google:null,reason:"중복 의심"},{linkId:"g",siteId:null,googleId:"g",site:null,google,reason:"중복 의심"}]});
  render(<CalendarSyncPending siteId={10} name="가족" onClose={vi.fn()} onChanged={vi.fn(async()=>{})}/>);
  await userEvent.selectOptions(await screen.findByRole("combobox",{name:"검진 / 검진 중복 처리"}),"separate");
  await userEvent.click(screen.getByRole("button",{name:"선택한 항목 처리"}));
  expect(api.resolveCalendarSync).toHaveBeenCalledWith(10,"pending:hash",[{linkId:"s",siteId:1,googleId:null,source:"site"},{linkId:"g",siteId:null,googleId:"g",source:"google"}]);
});
