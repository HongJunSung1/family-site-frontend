import { useEffect, useState } from "react";
import { getPendingCalendarSync, resolveCalendarSync, type PendingSync, type PendingDecision, type SyncEvent } from "../../../../api/calendarSyncApi";
import styles from "./CalendarSettings.module.css";

const details=(item:SyncEvent|null)=>item ? `${item.title} · ${item.data?.start || item.start} ${item.data ? `~ ${item.data.end}${item.data.repeat!=="none" ? " · 반복 일정" : ""}` : ""}` : "일정 없음 / 삭제됨";
export default function CalendarSyncPending({siteId,name,onClose,onChanged}:{siteId:number;name:string;onClose:()=>void;onChanged:()=>Promise<void>}) {
  const [data,setData]=useState<PendingSync|null>(null);
  const [choices,setChoices]=useState<Record<string,string>>({});
  const [pairs,setPairs]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let cancelled=false;setData(null);setError("");setChoices({});setPairs({});
    getPendingCalendarSync(siteId).then(value=>{if(!cancelled)setData(value);}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"대기 항목을 불러오지 못했습니다.");});
    return()=>{cancelled=true;};
  },[siteId,revision]);
  const candidates=(data?.candidates || []).flatMap(pair=>{
    const site=data?.pending.find(item=>item.siteId===pair.siteId&&!item.googleId);
    const google=data?.pending.find(item=>item.googleId===pair.googleId&&!item.siteId);
    return site&&google ? [{site,google,key:JSON.stringify([pair.siteId,pair.googleId])}] : [];
  });
  const linked=candidates.filter(pair=>["site","google"].includes(pairs[pair.key]));
  const linkedIds=new Set(linked.flatMap(pair=>[pair.site.linkId,pair.google.linkId]));
  async function save(){
    if(!data)return;setBusy(true);setError("");setMessage("");
    try{
      const decisions:PendingDecision[]=linked.map(pair=>({siteId:pair.site.siteId,googleId:pair.google.googleId,source:pairs[pair.key] as "site"|"google"}));
      for(const item of data.pending){
        if(linkedIds.has(item.linkId))continue;
        const matches=candidates.filter(pair=>pair.site.linkId===item.linkId||pair.google.linkId===item.linkId);
        const separate=matches.length>0&&matches.every(pair=>pairs[pair.key]==="separate");
        const source=choices[item.linkId] || (separate ? item.siteId ? "site" : "google" : "");
        if(source)decisions.push({linkId:item.linkId,siteId:item.siteId,googleId:item.googleId,source:source as PendingDecision["source"]});
      }
      if(!decisions.length){setMessage("처리할 항목을 선택해주세요.");return;}
      const result=await resolveCalendarSync(siteId,data.previewHash,decisions);
      setMessage(`${result.changed}개 반영 · 확인 대기 ${result.reviewCount || 0}개${data.state.enabled ? "" : " · 자동 동기화가 중지되어 있어 반영은 재개 후 진행됩니다."}`);
      window.dispatchEvent(new Event("calendar-sync-updated"));await onChanged();setRevision(value=>value+1);
    }catch(e){setError(e instanceof Error?e.message:"처리하지 못했습니다. 다시 불러온 후 시도해주세요.");}
    finally{setBusy(false);}
  }
  return <section className={styles.syncPanel} aria-label={`${name} 확인 대기 항목`} aria-busy={busy||!data}>
    <div className={styles.connectionHeader}><h4>{name} · 확인 대기 항목{data ? ` (${data.pending.length}개)` : ""}</h4><button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>닫기</button></div>
    <p>선택한 항목만 처리합니다. 기존 동기화 방식과 시작 기준은 유지됩니다. 선택하지 않은 항목은 대기 상태로 남습니다.</p>
    <p className={styles.fieldHelp}>동기화 제외는 양쪽 일정을 삭제하지 않고 이후 자동 반영 대상에서 제외합니다. 지원하지 않는 일정은 원본에서 보류 사유를 수정한 뒤 다시 불러와 처리하세요.</p>
    {!data&&!error&&<p role="status">대기 항목을 불러오고 있습니다…</p>}
    {data&&!data.pending.length&&<p>확인 대기 항목이 없습니다.</p>}
    {!!candidates.length&&<><h4>중복 의심 일정</h4><div className={styles.mappingTableWrap}><table className={styles.mappingTable}><thead><tr><th>가족 캘린더</th><th>핸드폰 캘린더 (구글)</th><th>처리 방법</th></tr></thead><tbody>
      {candidates.map(pair=><tr key={pair.key}><td>{details(pair.site.site)}</td><td>{details(pair.google.google)}</td><td><select className={styles.addressInput} aria-label={`${pair.site.site?.title} / ${pair.google.google?.title} 중복 처리`} value={pairs[pair.key]||""} disabled={busy} onChange={e=>setPairs(old=>({...old,[pair.key]:e.target.value}))}>
        <option value="">나중에 확인</option><option value="separate">서로 다른 일정 · 각각 반영</option>
        <option value="site" disabled={linked.some(other=>other.key!==pair.key&&(other.site.linkId===pair.site.linkId||other.google.linkId===pair.google.linkId))}>같은 일정 · 가족 내용으로 연결</option>
        <option value="google" disabled={linked.some(other=>other.key!==pair.key&&(other.site.linkId===pair.site.linkId||other.google.linkId===pair.google.linkId))}>같은 일정 · 핸드폰 내용으로 연결</option>
      </select></td></tr>)}
    </tbody></table></div></>}
    {!!data?.pending.length&&<div className={styles.mappingTableWrap}><table className={styles.mappingTable}><thead><tr><th>가족 캘린더</th><th>핸드폰 캘린더 (구글)</th><th>보류 사유 / 처리</th></tr></thead><tbody>
      {data.pending.map(item=><tr key={item.linkId}><td>{details(item.site)}</td><td>{details(item.google)}</td><td><p>{item.reason}</p>
        {linkedIds.has(item.linkId)?<p>위에서 선택한 일정과 연결합니다.</p>:<select className={styles.addressInput} aria-label={`${item.site?.title||item.google?.title||"삭제된 일정"} 대기 처리`} disabled={busy} value={choices[item.linkId]||""} onChange={e=>setChoices(old=>({...old,[item.linkId]:e.target.value}))}>
          <option value="">나중에 확인 / 위 중복 선택 적용</option>
          <option value="site" disabled={!!item.site?.reason||!!item.google?.reason||(!item.site&&!(item.siteId&&item.googleId))}>{item.site?"가족 내용 반영 / 재시도":"가족에서 삭제한 내용을 핸드폰에도 반영"}</option>
          <option value="google" disabled={!!item.site?.reason||!!item.google?.reason||(!item.google&&!(item.siteId&&item.googleId))}>{item.google?"핸드폰 내용 반영 / 재시도":"핸드폰에서 삭제한 내용을 가족에도 반영"}</option>
          <option value="ignore">이 항목 동기화 제외 (일정 유지)</option>
        </select>}
      </td></tr>)}
    </tbody></table></div>}
    <div className={styles.connectionActions}><button type="button" className={styles.primaryButton} disabled={busy||!data?.pending.length} onClick={()=>void save()}>선택한 항목 처리</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>setRevision(value=>value+1)}>다시 불러오기</button></div>
    {error&&<p role="alert" className={styles.connectionError}>{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
