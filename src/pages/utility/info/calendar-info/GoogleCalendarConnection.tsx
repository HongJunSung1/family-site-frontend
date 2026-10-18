import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { startFutureCalendarSync, pauseCalendarSync } from "../../../../api/calendarSyncApi";
import { getMyCalendars, type MyCalendar } from "../../../../api/calendarApi";
import { connectGoogleCalendar, disconnectGoogleCalendar, getGoogleCalendarStatus, listGoogleCalendars,
  saveGoogleCalendarSelection, type GoogleCalendarChoice, type GoogleCalendarStatus } from "../../../../api/googleCalendarApi";
import { ConfirmDialog } from "../../../../common/dialog";
import styles from "./CalendarSettings.module.css";
// Existing-event review is temporarily disabled.
// import CalendarSyncPanel from "./CalendarSyncPanel";
// import { previewCalendarSync, startCalendarSync, type SyncPreview } from "../../../../api/calendarSyncApi";
import CalendarSyncPending from "./CalendarSyncPending";

const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "구글 계정이 연결되었습니다. 연결할 캘린더를 선택해주세요.",
  denied: "구글 연결 승인을 취소했습니다.",
  session_expired: "로그인이 만료되었습니다. 로그인 후 다시 연결해주세요.",
  missing_permissions: "캘린더 접근 권한을 모두 승인한 뒤 다시 연결해주세요.",
  offline_access_required: "자동 연결을 위한 권한이 필요합니다. 다시 연결해주세요.",
  account_in_use: "다른 회원이 이미 연결한 구글 계정입니다. 본인의 구글 계정을 선택해주세요.",
  failed: "구글 연결에 실패했습니다. 서버 설정과 구글 권한을 확인한 뒤 다시 시도해주세요.",
};

export default function GoogleCalendarConnection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const callbackResult = searchParams.get("googleCalendar");
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarChoice[]>([]);
  const [siteCalendars, setSiteCalendars] = useState<MyCalendar[]>([]);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() => callbackResult ? CALLBACK_MESSAGES[callbackResult] || CALLBACK_MESSAGES.failed : "");
  const [reload, setReload] = useState(0);
  // const [syncCalendar, setSyncCalendar] = useState<MyCalendar | null>(null);
  const [confirmSyncCalendar, setConfirmSyncCalendar] = useState<MyCalendar | null>(null);
  // const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [pendingCalendar,setPendingCalendar]=useState<MyCalendar|null>(null);
  useEffect(() => {
    let cancelled=false;
    const refresh=()=>{void getGoogleCalendarStatus().then(value=>{if(!cancelled)setStatus(value);}).catch(()=>{});};
    window.addEventListener("calendar-sync-status",refresh);
    return ()=>{cancelled=true;window.removeEventListener("calendar-sync-status",refresh);};
  },[]);

  useEffect(() => {
    if (!callbackResult) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("googleCalendar");
      return next;
    }, { replace: true });
  }, [callbackResult, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const current = await getGoogleCalendarStatus();
        if (cancelled) return;
        setStatus(current);
        setSelections(Object.fromEntries(current.mappings.map(mapping => [mapping.site_calendar_id, mapping.google_calendar_id])));
        setGoogleCalendars([]);
        setSiteCalendars([]);
        if (current.connection && current.ready) {
          const [google, site] = await Promise.all([listGoogleCalendars(), getMyCalendars()]);
          if (cancelled) return;
          setGoogleCalendars(google.calendars);
          setSiteCalendars(site.filter(calendar => ["owner", "editor"].includes(calendar.role)));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "연결 정보를 불러오지 못했습니다.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reload]);

  async function perform(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (success) {
        setMessage(success);
        setReload(value => value + 1);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "요청 처리에 실패했습니다."); }
    finally { setBusy(false); }
  }

  /* Existing-event review: temporarily disabled.
  async function openSync(calendar: MyCalendar, start: boolean) {
    await perform(async () => {
      const preview = await previewCalendarSync(calendar.calendarId);
      const needsReview = preview.conflicts.length > 0 || preview.candidates.some(candidate =>
        preview.site.some(item => Number(item.id) === candidate.siteId) && preview.google.some(item => item.id === candidate.googleId));
      if (start && !needsReview) {
        await startCalendarSync(calendar.calendarId, preview.previewHash, []);
        setMessage(`${calendar.name}: 동기화를 시작했습니다.`);
        window.dispatchEvent(new Event("calendar-sync-updated"));
        setStatus(await getGoogleCalendarStatus());
      } else {
        setSyncPreview(preview);
        setSyncCalendar(calendar);
      }
    });
  }

  */

  async function saveRow(calendar: MyCalendar) {
    const googleId = selections[calendar.calendarId] || "";
    await perform(async () => {
      await saveGoogleCalendarSelection(googleId || null, calendar.calendarId);
      setStatus(current => current ? { ...current, mappings: [
        ...current.mappings.filter(mapping => mapping.site_calendar_id !== calendar.calendarId),
        ...(googleId ? [{ site_calendar_id: calendar.calendarId, google_calendar_id: googleId,
          google_calendar_name: googleCalendars.find(item => item.id === googleId)?.summary || googleId }] : []),
      ] } : current);
      setMessage(`${calendar.name}: ${googleId ? "연결 설정을 저장했습니다." : "캘린더 연결을 해제했습니다."}`);
    });
  }

  return (
    <details className={styles.settingsSection} aria-labelledby="google-calendar-heading" aria-busy={loading || busy}>
      <summary className={styles.sectionToggle}>
        <span>
          <span id="google-calendar-heading" className={styles.subsectionTitle}>내 구글 캘린더 연결</span>
          <span className={styles.sectionDescription}>내 구글 캘린더 연결과 동기화를 관리합니다.</span>
        </span>
        <svg className={styles.chevron} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className={styles.sectionBody}>
      <span className={styles.statusBadge}>{loading ? "확인 중" : status?.connection ? "계정 연결됨" : "연결 안 됨"}</span>
      <p className={styles.description}>본인의 구글 계정과 가족 사이트에서 사용할 캘린더를 연결합니다.</p>
      {status && !status.ready && <p className={styles.fieldHelp}>구글 캘린더 연결을 준비 중입니다. 사이트 운영자에게 문의해주세요.</p>}
      {status?.connection && <p className={styles.connectedEmail}>연결 계정: {status.connection.email}</p>}
      <div className={styles.connectionActions}>
        <button type="button" className={styles.primaryButton} disabled={loading || busy || !status?.ready}
          onClick={() => { void perform(connectGoogleCalendar); }}>
          {busy ? "처리 중..." : status?.connection ? "구글 계정 다시 연결" : "내 구글 캘린더 연결"}
        </button>
        {status?.connection && <button type="button" className={styles.secondaryButton} disabled={busy || loading}
          onClick={() => setConfirmDisconnect(true)}>연결 해제</button>}
        {error && <button type="button" className={styles.secondaryButton} disabled={busy || loading}
          onClick={() => setReload(value => value + 1)}>다시 불러오기</button>}
      </div>
      {status?.connection && (
        <div className={styles.connectionFields}>
          <p className={styles.fieldHelp}>연결할 사이트 캘린더의 오른쪽에서 구글 캘린더를 선택하고 해당 행을 저장하세요. 나머지는 ‘연결 안 함’으로 두어도 됩니다.</p>
          <div className={styles.mappingTableWrap}>
            <table className={styles.mappingTable}>
              <thead><tr><th scope="col">사이트 캘린더</th><th scope="col">구글 캘린더</th><th scope="col">저장 / 동기화</th></tr></thead>
              <tbody>
                {siteCalendars.map(calendar => {
                  const saved = status.mappings.find(mapping => mapping.site_calendar_id === calendar.calendarId);
                  const selected = selections[calendar.calendarId] || "";
                  const changed = selected !== (saved?.google_calendar_id || "");
                  const missing = selected && !googleCalendars.some(item => item.id === selected);
                  const duplicate = selected && status.mappings.some(mapping => mapping.site_calendar_id !== calendar.calendarId && mapping.google_calendar_id === selected);
                  return (
                    <tr key={calendar.calendarId}>
                      <th scope="row">{calendar.name}<span className={styles.mappingStatus}>{changed ? "저장 전" : saved?.sync_enabled ? "자동 동기화 중" : saved ? "연결 설정됨" : "연결 안 함"}</span>
                        {!!saved?.review_count && <button type="button" className={styles.secondaryButton} disabled={loading||busy||changed||!!missing}
                          aria-label={`${calendar.name} 확인 대기 ${saved.review_count}개 처리`} onClick={()=>setPendingCalendar(calendar)}>확인 대기 {saved.review_count}개 · 확인 / 처리</button>}
                        {!!saved?.sync_initialized && <span className={styles.mappingStatus}>방식: {saved.sync_mode === "future" ? "앞으로 입력되는 일정만" : "기존 일정 확인 후 동기화"}</span>}
                        {saved?.sync_mode === "future" && saved.mode_started_at && <span className={styles.mappingStatus}>새 일정 기준: {new Date(saved.mode_started_at).toLocaleString("ko-KR")}</span>}
                        {!!saved?.pending_count && <span className={styles.mappingStatus}>반영 대기 {saved.pending_count}개 · 순차 처리 중</span>}
                        {saved?.last_synced_at && <span className={styles.mappingStatus}>최근 실행: {new Date(saved.last_synced_at).toLocaleString("ko-KR")}</span>}
                        {saved?.last_error && <span className={styles.connectionError}>{saved.last_error}</span>}
                      </th>
                      <td>
                        <select className={styles.addressInput} aria-label={`${calendar.name}에 연결할 구글 캘린더`}
                          value={selected} disabled={loading || busy}
                          onChange={event => setSelections(current => ({ ...current, [calendar.calendarId]: event.target.value }))}>
                          <option value="">연결 안 함</option>
                          {missing && <option value={selected} disabled>{saved?.google_calendar_name || selected} (사용할 수 없음)</option>}
                          {googleCalendars.map(google => {
                            const used = status.mappings.some(mapping => mapping.site_calendar_id !== calendar.calendarId && mapping.google_calendar_id === google.id);
                            return <option key={google.id} value={google.id} disabled={used}>{google.summary}{used ? " (다른 캘린더에 연결됨)" : ""}</option>;
                          })}
                        </select>
                        {duplicate && <span className={styles.connectionError}>다른 행에서 사용 중입니다. 다른 구글 캘린더를 선택하세요.</span>}
                      </td>
                      <td><div className={styles.connectionActions}><button type="button" className={styles.primaryButton} aria-label={`${calendar.name} 연결 설정 저장`}
                        disabled={loading || busy || !changed || !!missing || !!duplicate}
                        onClick={() => { void saveRow(calendar); }}>저장</button>
                        <button type="button" className={styles.secondaryButton} disabled={loading || busy || changed || !saved || !!missing}
                          aria-label={`${calendar.name} 동기화 ${saved?.sync_enabled ? "관리" : "시작"}`}
                          onClick={() => setConfirmSyncCalendar(calendar)}>{saved?.sync_enabled ? "동기화 관리" : "동기화 시작"}</button></div></td>
                    </tr>
                  );
                })}
                {!loading && siteCalendars.length === 0 && <tr><td colSpan={3}>연결할 수 있는 사이트 캘린더가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className={styles.fieldHelp}>사이트 캘린더마다 서로 다른 구글 캘린더를 연결할 수 있습니다. ‘연결 안 함’으로 저장하면 해당 행의 연결만 해제됩니다.</p>
        </div>
      )}
      <Dialog open={!!pendingCalendar} fullWidth maxWidth="lg" aria-label="동기화 확인 대기 처리" sx={{zIndex:20000}}
        slotProps={{paper:{sx:{backgroundColor:"#242a38",color:"#fff"}}}}>
        {pendingCalendar&&<CalendarSyncPending siteId={pendingCalendar.calendarId} name={pendingCalendar.name} onClose={()=>setPendingCalendar(null)} onChanged={async()=>setStatus(await getGoogleCalendarStatus())}/>}
      </Dialog>
      {/* Existing-event review: temporarily disabled.
      <Dialog open={!!syncCalendar} fullWidth maxWidth="lg" aria-label="캘린더 동기화" sx={{zIndex:20000}}
        slotProps={{paper:{sx:{backgroundColor:"#242a38",color:"#fff"}}}}>
        {syncCalendar && <CalendarSyncPanel key={syncCalendar.calendarId} siteId={syncCalendar.calendarId} name={syncCalendar.name}
          initialPreview={syncPreview || undefined}
          onClose={() => setSyncCalendar(null)} onChanged={async () => setStatus(await getGoogleCalendarStatus())}
          onStarted={() => { setMessage(`${syncCalendar.name}: 동기화를 시작했습니다.`); setSyncCalendar(null); }} />}
      </Dialog>
      */}
      <p className={styles.fieldHelp}>동기화 시작 이후 새로 저장되는 일정과 해당 일정의 수정·삭제만 양방향으로 반영합니다. 본인이 작성한 일정만 연동됩니다.</p>
      {message && <p className={styles.fieldHelp} role="status">{message}</p>}
      {error && <p className={styles.connectionError} role="alert">{error}</p>}
      <Dialog open={!!confirmSyncCalendar} onClose={()=>setConfirmSyncCalendar(null)} fullWidth maxWidth="sm" sx={{zIndex:20000}}>
        <DialogTitle>캘린더 동기화</DialogTitle>
        <DialogContent>
          <div><span style={{fontWeight:800, color:'red'}}>앞으로 저장되는 일정</span>만 동기화가 진행됩니다.</div>
          <div>· 동기화 전에 저장된 일정 : 그대로 유지</div>
          <div>· 동기화 이후 새로 저장되는 일정 : 공유캘린더, 핸드폰 양방향으로 자동 반영</div>
          {status?.mappings.find(m=>m.site_calendar_id===confirmSyncCalendar?.calendarId)?.sync_mode === "future" && <p>이미 동기화한 캘린더는 처음 설정한 기준 시점을 유지합니다.</p>}
        </DialogContent>
        <DialogActions>
          {!!status?.mappings.find(m=>m.site_calendar_id===confirmSyncCalendar?.calendarId)?.sync_enabled&&<Button onClick={()=>{
            const calendar=confirmSyncCalendar;setConfirmSyncCalendar(null);if(calendar)void perform(async()=>{
              await pauseCalendarSync(calendar.calendarId);setStatus(await getGoogleCalendarStatus());setMessage("자동 동기화를 중지했습니다.");
            });
          }}>자동 동기화 중지</Button>}
          {/* <div className={styles.connectionActions}> */}
            {/* 기존 일정 동기화는 안정성 확인 전까지 비활성화합니다.
            <Button onClick={()=>{const calendar=confirmSyncCalendar;setConfirmSyncCalendar(null);if(calendar)void openSync(calendar,!status?.mappings.find(m=>m.site_calendar_id===calendar.calendarId)?.sync_enabled);}}>기존 일정 확인 후 동기화</Button>
            */}
            <Button onClick={()=>{const calendar=confirmSyncCalendar;setConfirmSyncCalendar(null);if(calendar)void perform(async()=>{
              await startFutureCalendarSync(calendar.calendarId);setStatus(await getGoogleCalendarStatus());
              setMessage(`${calendar.name}: 앞으로 입력되는 일정만 양방향으로 동기화합니다.`);
            });}}>확인</Button>
          {/* </div> */}
          <Button onClick={()=>setConfirmSyncCalendar(null)}>취소</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog open={confirmDisconnect} title="구글 캘린더 연결 해제" message="사이트의 구글 연결 정보를 삭제할까요? 기존 일정은 삭제되지 않습니다."
        confirmLabel="연결 해제" cancelLabel="취소" onClose={() => setConfirmDisconnect(false)}
        onConfirm={() => { setConfirmDisconnect(false); void perform(disconnectGoogleCalendar, "구글 캘린더 연결을 해제했습니다."); }} />
      </div>
    </details>
  );
}
