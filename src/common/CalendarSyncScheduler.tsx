import { useEffect } from "react";
import { tickCalendarSync } from "../api/calendarSyncApi";

// 로컬에서는 브라우저가 열린 동안, 운영에서는 서버 Cron과 함께 실행한다.
export default function CalendarSyncScheduler() {
  useEffect(()=>{
    let cancelled=false;
    let running=false;
    let forceNeeded=false;
    let timer:ReturnType<typeof setTimeout>;
    async function tick() {
      if(running||cancelled)return;
      running=true;
      let delay=60000;
      try {
        if(document.visibilityState!=="hidden" || forceNeeded) {
          const force=forceNeeded;forceNeeded=false;
          const result=await tickCalendarSync(force);
          if(result.pendingCount)delay=1500;
          if(!cancelled)window.dispatchEvent(new Event("calendar-sync-status"));
          // Cron 또는 다른 브라우저가 먼저 반영했으면 이번 요청의 changed는 0이어도 목록은 달라져 있다.
          if(!cancelled)window.dispatchEvent(new Event("calendar-sync-updated"));
        }
      }catch{/* 연결 상태와 오류는 캘린더 환경설정에서 확인 */}
      finally{running=false;if(!cancelled)timer=setTimeout(()=>{void tick();},forceNeeded?100:delay);}
    }
    const request=()=>{forceNeeded=true;if(!running){clearTimeout(timer);timer=setTimeout(()=>{void tick();},100);}};
    const visible=()=>{if(document.visibilityState==="visible")request();};
    window.addEventListener("calendar-sync-request",request);
    document.addEventListener("visibilitychange",visible);
    timer=setTimeout(()=>{void tick();},3000);
    return ()=>{cancelled=true;clearTimeout(timer);window.removeEventListener("calendar-sync-request",request);document.removeEventListener("visibilitychange",visible);};
  },[]);
  return null;
}
