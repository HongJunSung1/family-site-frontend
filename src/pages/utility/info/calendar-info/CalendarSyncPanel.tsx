import { useEffect, useState } from "react";
import { pauseCalendarSync, previewCalendarSync, runCalendarSync, startCalendarSync,
  type SyncDecision, type SyncEvent, type SyncPreview } from "../../../../api/calendarSyncApi";
import styles from "./CalendarSettings.module.css";

function details(event: SyncEvent | null) {
  if (!event) return "삭제된 일정";
  const d = event.data;
  const repeat = d && d.repeat !== "none" ? ` · ${d.interval}${({daily:"일",weekly:"주",monthly:"개월",yearly:"년"} as Record<string,string>)[d.repeat]}마다 반복${d.repeat === "monthly" ? ` (${d.anchor}일, 없는 달은 ${d.monthPolicy === "skip" ? "건너뜀" : "말일"})` : ""}${d.until ? `, ${d.until}까지` : ""}` : "";
  return `${event.title} · ${d?.start || event.start}${d ? ` ~ ${d.end}` : ""}${repeat}`;
}

export default function CalendarSyncPanel({ siteId, name, onClose, onChanged, initialPreview, onStarted }: {
  siteId:number; name:string; onClose:()=>void; onChanged:()=>Promise<void>;
  initialPreview?:SyncPreview; onStarted?:()=>void;
}) {
  const [preview,setPreview]=useState<SyncPreview|null>(null);
  const [pairs,setPairs]=useState<Record<string,string>>({});
  const [sources,setSources]=useState<Record<string,"site"|"google">>({});

  const [conflicts,setConflicts]=useState<Record<string,"site"|"google"|"hold">>({});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if (revision === 0 && initialPreview) {
      setPreview(initialPreview);setLoading(false);return;
    }
    let cancelled=false;
    setLoading(true);setError("");setPreview(null);
    setPairs({});setSources({});setConflicts({});
    previewCalendarSync(siteId).then(data=>{if(!cancelled)setPreview(data);})
      .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"일정 비교에 실패했습니다.");})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[siteId,revision,initialPreview]);
  const candidates = (preview?.candidates || []).flatMap(candidate => {
    const site = preview?.site.find(item => Number(item.id) === candidate.siteId);
    const google = preview?.google.find(item => item.id === candidate.googleId);
    return site && google ? [{site,google,key:JSON.stringify([site.id,google.id])}] : [];
  });
  const linked = candidates.filter(candidate => pairs[candidate.key] === "link");
  async function execute(action:"start"|"run"|"pause") {
    if(!preview)return;
    setBusy(true);setError("");setMessage("");
    try {
      if(action==="pause") { await pauseCalendarSync(siteId);setMessage("자동 동기화를 중지했습니다."); }
      else if(action==="run") { const result=await runCalendarSync(siteId);setMessage(`${result.changed}개 일정에 변경 사항을 반영했습니다.`); }
      else {
        const decisions:SyncDecision[]=[];
        for(const candidate of linked) decisions.push({siteId:Number(candidate.site.id),googleId:candidate.google.id,source:sources[candidate.key]||"site"});
        // 같은 일정이 아니라고 확인한 후보는 각각 독립된 일정으로 반영한다.
        for (const event of preview.site) {
          const matches=candidates.filter(candidate=>candidate.site.id===event.id);
          if(matches.length && matches.every(candidate=>pairs[candidate.key]==="skip") && event.data)
            decisions.push({siteId:Number(event.id),googleId:null,source:"site"});
        }
        for (const event of preview.google) {
          const matches=candidates.filter(candidate=>candidate.google.id===event.id);
          if(matches.length && matches.every(candidate=>pairs[candidate.key]==="skip") && event.data)
            decisions.push({siteId:null,googleId:event.id,source:"google"});
        }
        for(const conflict of preview.conflicts) if(conflicts[conflict.linkId] && conflicts[conflict.linkId]!=="hold") decisions.push({
          linkId:conflict.linkId,siteId:conflict.site?Number(conflict.site.id):null,googleId:conflict.google?.id||null,source:conflicts[conflict.linkId],
        });
        const result=await startCalendarSync(siteId,preview.previewHash,decisions);
        setMessage(`동기화를 시작했습니다. ${result.changed}개 반영, ${result.reviewCount||0}개 확인 대기입니다.`);
      }
      window.dispatchEvent(new Event("calendar-sync-updated"));
      await onChanged();
      if(action==="start" && onStarted) onStarted();
      else setRevision(v=>v+1);
    }catch(e){setError(e instanceof Error?e.message:"동기화 요청에 실패했습니다.");}
    finally{setBusy(false);}
  }
  return <section className={styles.syncPanel} aria-label={`${name} 동기화 비교`} aria-busy={loading||busy}>
    <div className={styles.connectionHeader}><h4 className={styles.subsectionTitle}>{name} · 일정 비교</h4>
      <button className={styles.secondaryButton} type="button" disabled={busy} onClick={onClose}>닫기</button></div>
    <p className={styles.fieldHelp}>같은 일정이면 연결하세요. 서로 다른 일정이면 별개로 처리합니다. 첫 동기화에서는 핸드폰 일정만 가져오며, 이후 새 일정과 변경은 양방향으로 반영합니다.</p>
    {loading&&<p role="status">양쪽 일정을 비교하고 있습니다…</p>}
    {preview&&<>
      {preview.state.lastError&&<p className={styles.connectionError}>{preview.state.lastError}</p>}
      {!!preview.blocked?.length&&<div role="status"><p>다음 일정은 확인이 필요합니다.</p><ul>{preview.blocked.map((item,index)=><li key={`${item.id}-${index}`}>{item.title}: {item.reason}</li>)}</ul></div>}
      {candidates.length > 0 ? <div className={styles.mappingTableWrap}><table className={styles.mappingTable}>
        <thead><tr><th>가족 캘린더</th><th>핸드폰 캘린더 (구글)</th><th>연결 여부</th></tr></thead>
        <tbody>{candidates.map(candidate => {
          const {site,google,key}=candidate;
          const taken=linked.some(other=>other.key!==key&&(other.site.id===site.id||other.google.id===google.id));
          return <tr key={key}>
            <td>{details(site)}{site.data?.memo&&<p className={styles.fieldHelp}>{site.data.memo}</p>}{site.data?.location&&<p className={styles.fieldHelp}>{site.data.location}</p>}</td>
            <td>{details(google)}{google.data?.memo&&<p className={styles.fieldHelp}>{google.data.memo}</p>}{google.data?.location&&<p className={styles.fieldHelp}>{google.data.location}</p>}</td>
            <td><select className={styles.addressInput} aria-label={site.title+" / "+google.title+" 연결 여부"} value={pairs[key]||""} disabled={busy}
              onChange={e=>setPairs(old=>({...old,[key]:e.target.value}))}>
              <option value="">선택 안 함 (보류)</option><option value="link" disabled={taken||!site.data||!google.data}>같은 일정 · 연결</option><option value="skip">서로 다른 일정</option>
            </select>
            {taken&&<p className={styles.fieldHelp}>다른 일정과 연결하도록 선택했습니다.</p>}
            {pairs[key]==="link"&&<select className={styles.addressInput} aria-label={site.title+" / "+google.title+" 기준"} value={sources[key]||"site"} disabled={busy}
              onChange={e=>setSources(old=>({...old,[key]:e.target.value as "site"|"google"}))}>
              <option value="site">가족 캘린더 내용 사용</option><option value="google">핸드폰 캘린더 내용 사용</option>
            </select>}</td>
          </tr>;
        })}</tbody>
      </table></div> : <p>중복이 의심되는 일정이 없습니다.</p>}
      <p className={styles.fieldHelp}>처음부터 가족 캘린더에만 있던 일정은 핸드폰으로 보내지 않습니다. 핸드폰에만 있던 일정은 자동으로 가져옵니다. 지원하지 않는 반복 규칙 등은 확인이 필요합니다.</p>
      {preview.conflicts.map(conflict=><div className={styles.syncConflict} key={conflict.linkId}>
        <p>{conflict.reason}</p><p>사이트: {details(conflict.site)}</p><p>구글: {details(conflict.google)}</p>
        <select className={styles.addressInput} aria-label="충돌 해결 기준" disabled={busy||!!conflict.site?.reason||!!conflict.google?.reason}
          value={conflicts[conflict.linkId]||"hold"} onChange={e=>setConflicts(old=>({...old,[conflict.linkId]:e.target.value as "site"|"google"|"hold"}))}>
          <option value="hold">나중에 확인</option><option value="site">{conflict.site?"사이트 내용 사용":"사이트 삭제를 구글에도 반영"}</option>
          <option value="google">{conflict.google?"구글 내용 사용":"구글 삭제를 사이트에도 반영"}</option></select>
      </div>)}
      <p className={styles.fieldHelp}>선택한 기준 내용으로 반영합니다. 시작 후에는 새 일정과 연결된 일정의 변경·삭제가 자동 반영됩니다. 중복 의심 및 양쪽 동시 수정은 확인 대기로 남습니다.</p>
      <div className={styles.connectionActions}>
        <button type="button" className={styles.primaryButton} disabled={busy} onClick={()=>{void execute("start");}}>{busy?"처리 중…":"확인한 내용으로 동기화 시작"}</button>
        {preview.state.enabled&&<><button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>{void execute("run");}}>지금 동기화</button>
        <button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>{void execute("pause");}}>자동 동기화 중지</button></>}
      </div>
    </>}
    <button type="button" className={styles.secondaryButton} disabled={busy||loading} onClick={()=>setRevision(v=>v+1)}>다시 비교</button>
    {error&&<p className={styles.connectionError} role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
