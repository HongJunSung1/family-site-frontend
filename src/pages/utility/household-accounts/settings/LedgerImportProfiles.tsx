import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { ApiError } from "../../../../api/client";
import {
  getLedgerImportProfiles,
  saveLedgerImportProfile,
  type LedgerImportMapping,
  type LedgerImportProfile,
  type LedgerImportProfilePayload,
  type LedgerImportRules,
} from "../../../../api/ledgerApi";
import { AlertDialog } from "../../../../common/dialog";
import { LoadingOverlay } from "../../../../common/loading";
import type { LedgerScreenProps } from "../types";
import styles from "../HouseholdAccounts.module.css";

type SheetData = { name: string; rows: unknown[][] };
type Form = {
  id?: number; profileName: string; institutionName: string; sheetName: string;
  headerRow: number; mapping: LedgerImportMapping; rules: LedgerImportRules; isActive: boolean;
};
const emptyForm = (): Form => ({
  profileName: "", institutionName: "", sheetName: "", headerRow: 1, mapping: {},
  rules: { amountMode: "SEPARATE", dateFormat: "AUTO", inflowValues: ["입금"], outflowValues: ["출금"] },
  isActive: true,
});
const cell = (value: unknown) => value == null ? "" : String(value).trim();
const normalizedHeaders = (headers: string[]) => {
  const result = headers.map((value) => value.trim().toLocaleLowerCase("ko"));
  while (result.length && !result[result.length - 1]) result.pop();
  return result;
};
const headerSignature = (headers: string[]) => JSON.stringify(normalizedHeaders(headers));
const headerMatches = (stored: string, headers: string[]) => {
  try {
    const saved = JSON.parse(stored);
    return Array.isArray(saved) && headerSignature(saved.map(cell)) === headerSignature(headers);
  } catch { return stored === headerSignature(headers); }
};
const splitValues = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const joinValues = (value?: string[]) => (value ?? []).join(", ");
const numberText = (value: unknown) => cell(value).replace(/[원,\s]/g, "");
const nonzeroNumberText = (value: unknown) => {
  const result = numberText(value);
  return /^-?0*(?:\.0*)?$/.test(result) ? "" : result;
};

function dateText(value: unknown, format: LedgerImportRules["dateFormat"]) {
  if (typeof value === "number" || format === "EXCEL_SERIAL") {
    const serial = Number(value);
    if (Number.isFinite(serial)) {
      const parsed = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
      return parsed.toISOString().slice(0, 10);
    }
  }
  const raw = cell(value);
  const matched = raw.match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);
  return matched ? `${matched[1]}-${matched[2].padStart(2, "0")}-${matched[3].padStart(2, "0")}` : raw;
}

export default function LedgerImportProfiles({ calendarId, calendarControl }: LedgerScreenProps) {
  const [profiles, setProfiles] = useState<LedgerImportProfile[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sampleName, setSampleName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [encryptedSample, setEncryptedSample] = useState<{ name: string; data: ArrayBuffer } | null>(null);
  const [samplePassword, setSamplePassword] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const sampleInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!calendarId) return;
    setLoading(true);
    try {
      const result = await getLedgerImportProfiles(calendarId);
      setProfiles(result.profiles); setCanManage(result.canManage);
    } catch (error) {
      setAlert({ title: "조회 실패", message: error instanceof ApiError ? error.message : "가져오기 양식을 불러오지 못했습니다." });
    } finally { setLoading(false); }
  }, [calendarId]);
  useEffect(() => { setForm(null); setSheets([]); setSampleName(""); void load(); }, [load]);

  const selectedSheet = sheets.find((sheet) => sheet.name === form?.sheetName) ?? sheets[0];
  const headerCells = useMemo(() => selectedSheet
    ? (selectedSheet.rows[(form?.headerRow ?? 1) - 1] ?? []).map(cell)
    : [], [form?.headerRow, selectedSheet]);
  const headers = useMemo(() => selectedSheet
    ? headerCells.filter(Boolean)
    : form ? [...new Set([...Object.values(form.mapping), form.rules.excludeColumn].filter((value): value is string => !!value))] : [],
  [form, headerCells, selectedSheet]);
  const recommendedProfile = useMemo(() => sampleName && selectedSheet
    ? profiles.find((profile) => profile.is_active && headerMatches(
      profile.header_signature,
      (selectedSheet.rows[profile.header_row - 1] ?? []).map(cell),
    )) : undefined, [profiles, sampleName, selectedSheet]);
  const preview = useMemo(() => {
    if (!form || !selectedSheet || !headers.length) return [];
    const index = new Map(headerCells.map((name, column) => [name, column]));
    const read = (row: unknown[], name?: string) => name ? row[index.get(name) ?? -1] : "";
    return selectedSheet.rows.slice(form.headerRow, form.headerRow + 20).flatMap((row, rowIndex) => {
      const description = cell(read(row, form.mapping.description));
      const automaticExcluded = /^(합계|총계|전월이월|이월잔액|조회기간)$/.test(description.replace(/\s/g, ""));
      const excluded = form.rules.excludeColumn && form.rules.excludeValues?.some((value) => cell(read(row, form.rules.excludeColumn)).includes(value));
      if (automaticExcluded || excluded || row.every((value) => !cell(value))) return [];
      const mode = form.rules.amountMode;
      const directionValue = cell(read(row, form.mapping.direction));
      const rawAmount = mode === "SEPARATE"
        ? nonzeroNumberText(read(row, form.mapping.income)) || (nonzeroNumberText(read(row, form.mapping.expense)) ? `-${nonzeroNumberText(read(row, form.mapping.expense))}` : "")
        : numberText(read(row, form.mapping.amount));
      const amount = mode === "DIRECTION" && form.rules.outflowValues?.includes(directionValue) && !rawAmount.startsWith("-")
        ? `-${rawAmount}` : rawAmount;
      return [{
        key: rowIndex, date: dateText(read(row, form.mapping.date), form.rules.dateFormat),
        description, counterparty: cell(read(row, form.mapping.counterparty)), amount,
      }];
    }).slice(0, 5);
  }, [form, headerCells, headers, selectedSheet]);

  function edit(profile?: LedgerImportProfile) {
    setSheets([]); setSampleName("");
    setShowAdvanced(false);
    setForm(profile ? {
      id: profile.id, profileName: profile.profile_name, institutionName: profile.institution_name,
      sheetName: profile.sheet_name ?? "", headerRow: profile.header_row, mapping: profile.mapping,
      rules: profile.rules, isActive: !!profile.is_active,
    } : emptyForm());
  }

  async function applyWorkbook(data: ArrayBuffer | Uint8Array, fileName: string) {
    if (!form) return;
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(data, { type: "array", cellDates: false });
    const nextSheets = workbook.SheetNames.map((name) => ({
      name, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: "", range: 0 }),
    }));
    setSheets(nextSheets); setSampleName(fileName);
    setForm({ ...form, sheetName: nextSheets[0]?.name ?? "", headerRow: 1, mapping: {} });
  }

  async function readSample(file?: File) {
    if (!file || !form) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setAlert({ title: "파일 확인", message: "XLS 또는 XLSX 파일을 선택해주세요." }); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAlert({ title: "파일 확인", message: "샘플 파일은 10MB 이하만 읽을 수 있습니다." }); return;
    }
    try {
      const data = await file.arrayBuffer();
      try {
        await applyWorkbook(data, file.name);
      } catch {
        try {
          const officeCrypto = (await import("officecrypto-tool")).default;
          if (!officeCrypto.isEncrypted(data as never)) throw new Error("not-encrypted");
          setEncryptedSample({ name: file.name, data });
          setSamplePassword("");
        } catch {
          setAlert({ title: "파일 읽기 실패", message: "엑셀 파일을 읽을 수 없습니다. 손상되었거나 지원하지 않는 파일인지 확인해주세요." });
        }
      }
    } catch {
      setAlert({ title: "파일 읽기 실패", message: "엑셀 파일을 읽을 수 없습니다. 암호가 설정되었거나 손상된 파일인지 확인해주세요." });
    }
  }

  async function decryptSample() {
    if (!encryptedSample || !samplePassword) return;
    setDecrypting(true);
    try {
      const officeCrypto = (await import("officecrypto-tool")).default;
      const decrypted = await officeCrypto.decrypt(encryptedSample.data as never, { password: samplePassword });
      await applyWorkbook(new Uint8Array(decrypted), encryptedSample.name);
      setEncryptedSample(null); setSamplePassword("");
    } catch {
      setAlert({ title: "파일 열기 실패", message: "비밀번호가 올바르지 않거나 지원하지 않는 은행 엑셀 암호화 방식입니다." });
    } finally { setDecrypting(false); }
  }

  function closeEncryptedSample() {
    setEncryptedSample(null); setSamplePassword("");
    if (sampleInputRef.current) sampleInputRef.current.value = "";
  }

  function mappingSelect(label: string, key: keyof LedgerImportMapping, required = false) {
    return <label>{label}{required && <em>*</em>}<select value={form?.mapping[key] ?? ""} onChange={(event) => form && setForm({ ...form, mapping: { ...form.mapping, [key]: event.target.value || undefined } })}>
      <option value="">선택 안 함</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}
    </select></label>;
  }

  async function save() {
    if (!form) return;
    const { mapping, rules } = form;
    const amountValid = rules.amountMode === "SIGNED" ? !!mapping.amount
      : rules.amountMode === "SEPARATE" ? !!mapping.income && !!mapping.expense
        : !!mapping.amount && !!mapping.direction && !!rules.inflowValues?.length && !!rules.outflowValues?.length;
    if (!form.profileName.trim() || !form.institutionName.trim() || !mapping.date || !mapping.description || !amountValid) {
      setAlert({ title: "입력 확인", message: "양식명·기관명·거래일·거래내용(적요)과 금액 형태에 필요한 열을 모두 지정해주세요." }); return;
    }
    setSaving(true);
    try {
      const payload: LedgerImportProfilePayload = {
        calendarId, profileName: form.profileName, institutionName: form.institutionName,
        sheetName: form.sheetName, headerRow: form.headerRow,
        headerSignature: headerSignature(headerCells.length ? headerCells : headers), mapping, rules, isActive: form.isActive,
      };
      await saveLedgerImportProfile(payload, form.id); setForm(null); setSheets([]); setSampleName(""); await load();
    } catch (error) {
      setAlert({ title: "저장 실패", message: error instanceof ApiError ? error.message : "가져오기 양식을 저장하지 못했습니다." });
    } finally { setSaving(false); }
  }

  return <section className={styles.screen}>
    <header className={styles.screenHeader}><h1>엑셀 가져오기 양식</h1><div className={styles.screenHeaderActions}>{calendarControl}{canManage && <button type="button" className={styles.primaryButton} onClick={() => edit()}>양식 추가</button>}</div></header>
    <div className={`${styles.importProfileLayout} ${form ? styles.importProfileEditing : ""}`}>
      <section className={styles.importProfileList}>
        <table><thead><tr><th>양식명</th><th>기관</th><th>시트</th><th>헤더 행</th><th>상태</th></tr></thead>
          <tbody>{profiles.map((profile) => <tr key={profile.id} onClick={() => edit(profile)}><td>{profile.profile_name}</td><td>{profile.institution_name}</td><td>{profile.sheet_name || "자동"}</td><td>{profile.header_row}</td><td>{profile.is_active ? "사용" : "미사용"}</td></tr>)}
          {!profiles.length && <tr><td colSpan={5} className={styles.sheetEmptyCell}>등록된 가져오기 양식이 없습니다.</td></tr>}</tbody></table>
      </section>
      {form && <aside className={styles.importProfileEditor}>
        <header><h2>{form.id ? "양식 수정" : "양식 추가"}</h2><button type="button" onClick={() => setForm(null)}>×</button></header>
        <div className={styles.importProfileFields}>
          <label>양식명<em>*</em><input value={form.profileName} onChange={(e) => setForm({ ...form, profileName: e.target.value })} /></label>
          <label>은행·기관명<em>*</em><input value={form.institutionName} onChange={(e) => setForm({ ...form, institutionName: e.target.value })} /></label>
          <div className={styles.importFileField}><strong>샘플 엑셀</strong><input ref={sampleInputRef} aria-label="샘플 엑셀 파일 선택" type="file" accept=".xls,.xlsx" hidden onChange={(event) => void readSample(event.target.files?.[0])} /><button type="button" className={styles.secondaryButton} onClick={() => sampleInputRef.current?.click()}>파일 선택</button><span>{sampleName || "파일은 브라우저에서만 읽고 저장하지 않습니다."}</span></div>
          {recommendedProfile && <button type="button" className={styles.importRecommendation} onClick={() => setForm({
            id: recommendedProfile.id, profileName: recommendedProfile.profile_name,
            institutionName: recommendedProfile.institution_name, sheetName: selectedSheet?.name ?? recommendedProfile.sheet_name ?? "",
            headerRow: recommendedProfile.header_row, mapping: recommendedProfile.mapping,
            rules: recommendedProfile.rules, isActive: true,
          })}>추천 양식 적용: {recommendedProfile.profile_name}</button>}
          {!!sheets.length && <><label>시트<select value={form.sheetName} onChange={(e) => setForm({ ...form, sheetName: e.target.value, mapping: {} })}>{sheets.map((sheet) => <option key={sheet.name}>{sheet.name}</option>)}</select></label>
          <label>헤더 행<input type="number" min={1} max={Math.min(100, selectedSheet?.rows.length ?? 100)} value={form.headerRow} onChange={(e) => setForm({ ...form, headerRow: Math.max(1, Number(e.target.value)), mapping: {} })} /></label></>}
          <h3>기본 열 선택</h3><div className={styles.importMappingGrid}>
            {mappingSelect("거래일", "date", true)}{mappingSelect("거래시간(선택)", "time")}{mappingSelect("거래내용(적요)", "description", true)}
            {mappingSelect("상대방(선택)", "counterparty")}
          </div>
          <h3>금액 열 선택</h3>
          <p className={styles.importSectionHelp}>잔액이 아니라 각 거래에서 실제로 입금되거나 출금된 금액 열을 선택해주세요.</p>
          <label>엑셀의 금액 형태<select value={form.rules.amountMode} onChange={(e) => setForm({ ...form, mapping: { date: form.mapping.date, time: form.mapping.time, description: form.mapping.description, counterparty: form.mapping.counterparty, memo: form.mapping.memo }, rules: { ...form.rules, amountMode: e.target.value as LedgerImportRules["amountMode"] } })}>
            <option value="SEPARATE">입금액과 출금액 열이 따로 있음</option><option value="DIRECTION">입출금 구분 열과 거래금액 열이 있음</option><option value="SIGNED">금액의 +/− 부호로 구분</option>
          </select></label>
          <div className={styles.importMappingGrid}>{form.rules.amountMode === "SEPARATE" ? <>{mappingSelect("입금액 열", "income", true)}{mappingSelect("출금액 열", "expense", true)}</> : <>{mappingSelect("거래금액 열(잔액 아님)", "amount", true)}{form.rules.amountMode === "DIRECTION" && mappingSelect("입출금 구분 열", "direction", true)}</>}</div>
          {form.rules.amountMode === "DIRECTION" && <div className={styles.importMappingGrid}>
            <label>입금 표시값<input value={joinValues(form.rules.inflowValues)} onChange={(e) => setForm({ ...form, rules: { ...form.rules, inflowValues: splitValues(e.target.value) } })} /></label>
            <label>출금 표시값<input value={joinValues(form.rules.outflowValues)} onChange={(e) => setForm({ ...form, rules: { ...form.rules, outflowValues: splitValues(e.target.value) } })} /></label>
          </div>}
          <button type="button" className={styles.importAdvancedToggle} aria-expanded={showAdvanced} onClick={() => setShowAdvanced((value) => !value)}>고급 설정 {showAdvanced ? "접기" : "열기"}</button>
          {showAdvanced && <div className={styles.importAdvancedPanel}>
            <h3>추가 열</h3>{mappingSelect("메모(선택)", "memo")}
            <h3>날짜 인식 방식</h3><label>날짜 형식<select value={form.rules.dateFormat} onChange={(e) => setForm({ ...form, rules: { ...form.rules, dateFormat: e.target.value as LedgerImportRules["dateFormat"] } })}><option value="AUTO">자동 인식(권장)</option><option value="YMD">연월일 텍스트</option><option value="YMDHMS">날짜와 시간 텍스트</option><option value="EXCEL_SERIAL">엑셀 날짜 숫자</option></select></label>
            <h3>가져오지 않을 행</h3><p className={styles.importSectionHelp}>합계·총계·전월이월·이월잔액 행은 기본적으로 제외됩니다. 그 밖의 행을 제외해야 할 때만 설정해주세요.</p><div className={styles.importMappingGrid}><label>검사할 열<select value={form.rules.excludeColumn ?? ""} onChange={(e) => setForm({ ...form, rules: { ...form.rules, excludeColumn: e.target.value || undefined } })}><option value="">추가 조건 없음</option>{headers.map((header) => <option key={header}>{header}</option>)}</select></label><label>제외할 값<input value={joinValues(form.rules.excludeValues)} placeholder="예: 취소, 오류" onChange={(e) => setForm({ ...form, rules: { ...form.rules, excludeValues: splitValues(e.target.value) } })} /></label></div>
          </div>}
          <label className={styles.importActiveField}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />사용</label>
          {!!preview.length && <><h3>변환 미리보기</h3><div className={styles.importPreview}><table><thead><tr><th>거래일</th><th>거래내용(적요)</th><th>상대방</th><th>거래금액</th></tr></thead><tbody>{preview.map((row) => <tr key={row.key}><td>{row.date}</td><td>{row.description}</td><td>{row.counterparty || "-"}</td><td>{row.amount}</td></tr>)}</tbody></table></div></>}
        </div><footer><button className={styles.secondaryButton} type="button" onClick={() => setForm(null)}>취소</button><button className={styles.primaryButton} disabled={saving || !canManage} type="button" onClick={() => void save()}>저장</button></footer>
      </aside>}
    </div>
    <LoadingOverlay active={loading} label="가져오기 양식 불러오는 중" />
    <Dialog open={!!encryptedSample} onClose={() => { if (!decrypting) closeEncryptedSample(); }} maxWidth="xs" fullWidth sx={{
      zIndex: 20000,
      "& .MuiDialog-paper": { border: "1px solid var(--color-border)", borderRadius: "10px", background: "var(--color-surface)", color: "var(--color-text)", boxShadow: "0 20px 50px rgb(0 0 0 / 35%)" },
      "& .MuiDialogTitle-root": { borderBottom: "1px solid var(--color-border)", fontFamily: "inherit", fontSize: "17px", fontWeight: 900 },
      "& .MuiDialogActions-root": { borderTop: "1px solid var(--color-border)", padding: "10px 16px" },
    }}>
      <DialogTitle>엑셀 비밀번호 입력</DialogTitle>
      <DialogContent className={styles.importPasswordDialog}><p>비밀번호로 보호된 파일입니다. 입력한 비밀번호와 파일은 서버에 전송하거나 저장하지 않습니다.</p><input autoFocus type="password" autoComplete="off" value={samplePassword} onChange={(e) => setSamplePassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void decryptSample(); }} /></DialogContent>
      <DialogActions><Button disabled={decrypting} onClick={closeEncryptedSample}>취소</Button><Button disabled={decrypting || !samplePassword} onClick={() => void decryptSample()}>파일 열기</Button></DialogActions>
    </Dialog>
    <AlertDialog open={!!alert} title={alert?.title ?? ""} message={alert?.message ?? ""} onClose={() => setAlert(null)} />
  </section>;
}
