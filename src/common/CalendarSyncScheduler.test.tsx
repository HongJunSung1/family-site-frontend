import { act, render, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CalendarSyncScheduler from "./CalendarSyncScheduler";
import { tickCalendarSync } from "../api/calendarSyncApi";
vi.mock("../api/calendarSyncApi",()=>({tickCalendarSync:vi.fn()}));
it("refreshes calendar data when the server already applied changes before the browser tick",async()=>{
  vi.useFakeTimers();
  vi.mocked(tickCalendarSync).mockResolvedValue({ok:true,changed:0});
  const refresh=vi.fn();
  window.addEventListener("calendar-sync-updated",refresh);
  try {
    render(<CalendarSyncScheduler/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
    expect(refresh).toHaveBeenCalledTimes(2);
  } finally { window.removeEventListener("calendar-sync-updated",refresh); }
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.resetAllMocks();});
it("coalesces site changes and queues changes made during an active sync",async()=>{
  vi.useFakeTimers();
  let finish!:(value:{ok:true;changed:number})=>void;
  vi.mocked(tickCalendarSync).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({ok:true,changed:0});
  render(<CalendarSyncScheduler/>);
  await act(async()=>{window.dispatchEvent(new Event("calendar-sync-request"));window.dispatchEvent(new Event("calendar-sync-request"));await vi.advanceTimersByTimeAsync(100);});
  expect(tickCalendarSync).toHaveBeenCalledExactlyOnceWith(true);
  await act(async()=>{window.dispatchEvent(new Event("calendar-sync-request"));await vi.advanceTimersByTimeAsync(1000);});
  expect(tickCalendarSync).toHaveBeenCalledTimes(1);
  await act(async()=>{finish({ok:true,changed:1});});
  await act(async()=>{await vi.advanceTimersByTimeAsync(100);});
  expect(tickCalendarSync).toHaveBeenNthCalledWith(2,true);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
  expect(tickCalendarSync).toHaveBeenNthCalledWith(3,false);
});
