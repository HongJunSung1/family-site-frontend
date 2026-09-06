import { useEffect, useRef, useState } from "react";
import type { AssetAccount } from "../../../../api/assetApi";
import {
  checkLedgerTransactionDuplicates, classifyLedgerTransactions, getLedgerImportProfiles, type LedgerDuplicateStatus,
  type LedgerImportProfile, type LedgerImportTransactionRow,
} from "../../../../api/ledgerApi";
import { ApiError } from "../../../../api/client";
import { AlertDialog } from "../../../../common/dialog";
import { LoadingOverlay } from "../../../../common/loading";
import styles from "../HouseholdAccounts.module.css";

type Props = {
  open: boolean; calendarId: number; accounts: AssetAccount[];
  onClose: () => void; onParsed: (rows: LedgerImportedRow[]) => void;
};
export type LedgerImportedRow = Omit<LedgerImportTransactionRow, "transactionKind" | "isReversal" | "categoryId"> & {
  classification: LedgerImportClassification; accountId: number; categoryId: number;
  classificationSource: "MANUAL" | "RULE"; duplicateStatus: LedgerDuplicateStatus;
  classificationConflict: boolean;
};
export type LedgerImportClassification = "UNCLASSIFIED" | "INCOME" | "EXPENSE" | "TRANSFER" | "INCOME_REVERSAL" | "EXPENSE_REVERSAL";
type Classification = LedgerImportClassification;
type Draft = Omit<LedgerImportTransactionRow, "transactionKind" | "isReversal"> & {
  key: number; included: boolean; error: string; classification: Classification;
};
const cell = (value: unknown) => value == null ? "" : String(value).trim();
const cleanNumber = (value: unknown) => cell(value).replace(/[원,\s]/g, "");
const nonzero = (value: unknown) => {
  const result = cleanNumber(value);
  return !result || /^-?0*(?:\.0*)?$/.test(result) ? "" : result;
};
const dateText = (value: unknown, format: LedgerImportProfile["rules"]["dateFormat"]) => {
  if (typeof value === "number" || format === "EXCEL_SERIAL") {
    const serial = Number(value);
    if (Number.isFinite(serial)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
  }
  const raw = cell(value); const match = raw.match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : raw;
};
const timeText = (value: unknown) => {
  if (typeof value === "number" && value >= 0 && value < 1) {
    const seconds = Math.round(value * 86400); return `${String(Math.floor(seconds / 3600) % 24).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}`;
  }
  const match = cell(value).match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)/); return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
};
const normalizedHeaders = (headers: string[]) => {
  const result = headers.map((value) => value.trim().toLocaleLowerCase("ko"));
  while (result.length && !result[result.length - 1]) result.pop();
  return result;
};
const signature = (headers: string[]) => JSON.stringify(normalizedHeaders(headers));
const headerMatches = (stored: string, headers: string[]) => {
  try {
    const saved = JSON.parse(stored);
    return Array.isArray(saved) && signature(saved.map(cell)) === signature(headers);
  } catch { return stored === signature(headers); }
};

export default function LedgerImportDialog({ open, calendarId, accounts, onClose, onParsed }: Props) {
  const [profiles, setProfiles] = useState<LedgerImportProfile[]>([]);
  const [profileId, setProfileId] = useState(0); const [accountId, setAccountId] = useState(0);
  const [fileName, setFileName] = useState(""); const [loading, setLoading] = useState(false);
  const [pendingRows, setPendingRows] = useState<LedgerImportedRow[]>([]);
  const [encrypted, setEncrypted] = useState<{ name: string; data: ArrayBuffer } | null>(null); const [password, setPassword] = useState("");
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null); const inputRef = useRef<HTMLInputElement>(null);
  const profile = profiles.find((item) => item.id === profileId);

  async function initialize() {
    setLoading(true);
    try {
      const result = await getLedgerImportProfiles(calendarId); const active = result.profiles.filter((item) => item.is_active);
      setProfiles(active); setProfileId(active[0]?.id ?? 0); setAccountId(accounts[0]?.id ?? 0);
    } catch (error) { setAlert({ title: "조회 실패", message: error instanceof ApiError ? error.message : "가져오기 양식을 불러오지 못했습니다." }); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (open) void initialize();
    else {
      setProfiles([]); setProfileId(0); setAccountId(0); setFileName("");
      setPendingRows([]); setEncrypted(null); setPassword("");
    }
  // Opening the dialog or changing the calendar starts a fresh in-memory import session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, calendarId]);
  if (!open) return null;

  async function applyWorkbook(data: ArrayBuffer | Uint8Array, name: string) {
    if (!profile) return;
    const XLSX = await import("xlsx"); const workbook = XLSX.read(data, { type: "array", cellDates: false });
    const sheetName = profile.sheet_name && workbook.Sheets[profile.sheet_name] ? profile.sheet_name : workbook.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "", range: 0 });
    const configuredHeaderIndex = profile.header_row - 1;
    const matchedHeaderIndex = profile.header_signature
      ? rawRows.slice(0, 100).findIndex((row) => headerMatches(profile.header_signature, row.map(cell)))
      : configuredHeaderIndex;
    const headerIndex = matchedHeaderIndex >= 0 ? matchedHeaderIndex : configuredHeaderIndex;
    const headers = (rawRows[headerIndex] ?? []).map(cell); const index = new Map(headers.map((header, column) => [header, column]));
    const read = (row: unknown[], column?: string) => column ? row[index.get(column) ?? -1] : "";
    if (profile.header_signature && !headerMatches(profile.header_signature, headers)) {
      throw new Error("HEADER_MISMATCH");
    }
    const parsed = rawRows.slice(headerIndex + 1).flatMap((row, sourceIndex): Draft[] => {
      const description = cell(read(row, profile.mapping.description)); const compact = description.replace(/\s/g, "");
      const ruleExcluded = !!profile.rules.excludeColumn && !!profile.rules.excludeValues?.some((value) => cell(read(row, profile.rules.excludeColumn)).includes(value));
      if (row.every((value) => !cell(value)) || /^(합계|총계|전월이월|이월잔액|조회기간)$/.test(compact) || ruleExcluded) return [];
      const directionValue = cell(read(row, profile.mapping.direction)); let signed = "";
      if (profile.rules.amountMode === "SEPARATE") {
        const income = nonzero(read(row, profile.mapping.income)); const expense = nonzero(read(row, profile.mapping.expense));
        signed = income ? income.replace("-", "") : expense ? `-${expense.replace("-", "")}` : "";
      } else {
        signed = cleanNumber(read(row, profile.mapping.amount));
        if (profile.rules.amountMode === "DIRECTION") {
          if (profile.rules.outflowValues?.some((value) => value === directionValue)) signed = `-${signed.replace("-", "")}`;
          if (profile.rules.inflowValues?.some((value) => value === directionValue)) signed = signed.replace("-", "");
        }
      }
      const directionMatched = profile.rules.amountMode !== "DIRECTION"
        || !!profile.rules.inflowValues?.some((value) => value === directionValue)
        || !!profile.rules.outflowValues?.some((value) => value === directionValue);
      const outgoing = signed.startsWith("-"); const amount = signed.replace(/[-+.]/g, "").replace(/^0+/, "");
      const date = dateText(read(row, profile.mapping.date), profile.rules.dateFormat); const categoryId = 0;
      const error = !directionMatched ? "입출금 구분 확인" : !/^\d{4}-\d{2}-\d{2}$/.test(date) ? "거래일 확인" : !/^[1-9]\d*$/.test(amount) ? "금액 확인" : !description ? "거래내용 확인" : "";
      return [{ key: sourceIndex, included: true, error, transactionDate: date, transactionTime: timeText(read(row, profile.mapping.time)) || null,
        classification: outgoing ? "EXPENSE" : "INCOME", direction: outgoing ? "OUTFLOW" : "INFLOW", amount, categoryId,
        description, counterparty: cell(read(row, profile.mapping.counterparty)), memo: cell(read(row, profile.mapping.memo)) }];
    });
    if (parsed.length > 500) throw new Error("TOO_MANY");
    if (!parsed.length) throw new Error("NO_ROWS");
    const candidates = parsed.map((row) => ({
      calendarId, accountId, transactionDate: row.transactionDate, transactionTime: row.transactionTime,
      transactionKind: row.classification === "INCOME" ? "INCOME" as const : "EXPENSE" as const,
      direction: row.direction, amount: row.amount, categoryId: 1,
      description: row.description, counterparty: row.counterparty, memo: row.memo,
      isReversal: false, entrySource: "EXCEL" as const,
    }));
    const [duplicateResult, classificationResult] = await Promise.all([
      checkLedgerTransactionDuplicates(calendarId, candidates),
      classifyLedgerTransactions(calendarId, candidates),
    ]);
    setPendingRows(parsed.map((row, rowIndex) => ({ accountId, transactionDate: row.transactionDate, transactionTime: row.transactionTime,
      direction: row.direction, amount: row.amount, description: row.description, counterparty: row.counterparty,
      memo: row.memo, classification: row.classification,
      categoryId: classificationResult.results[rowIndex]?.categoryId ?? 0,
      classificationSource: classificationResult.results[rowIndex]?.categoryId ? "RULE" : "MANUAL",
      classificationConflict: classificationResult.results[rowIndex]?.status === "CONFLICT",
      duplicateStatus: duplicateResult.statuses[rowIndex] ?? "NONE" })));
    setFileName(name); setEncrypted(null); setPassword("");
  }
  async function readFile(file?: File) {
    if (!file) return;
    setFileName(file.name); setPendingRows([]); setEncrypted(null); setPassword("");
    if (!profile) {
      setAlert({ title: "양식 확인", message: "가져오기 양식을 불러온 후 파일을 다시 선택해주세요." }); return;
    }
    if (!/\.(xlsx|xls)$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setAlert({ title: "파일 확인", message: "10MB 이하의 XLS 또는 XLSX 파일을 선택해주세요." }); return; }
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      try { await applyWorkbook(data, file.name); }
      catch (error) {
        if (error instanceof Error && ["HEADER_MISMATCH", "TOO_MANY"].includes(error.message)) throw error;
        const officeCrypto = (await import("officecrypto-tool")).default;
        if (!officeCrypto.isEncrypted(data as never)) throw error;
        setEncrypted({ name: file.name, data }); setPassword("");
      }
    } catch (error) {
      const message = error instanceof Error && error.message === "HEADER_MISMATCH" ? "선택한 양식과 파일의 헤더가 일치하지 않습니다."
        : error instanceof Error && error.message === "TOO_MANY" ? "한 번에 가져올 수 있는 거래는 최대 500건입니다."
          : error instanceof Error && error.message === "NO_ROWS" ? "가져올 거래 행이 없습니다. 양식의 제외 규칙과 파일 내용을 확인해주세요."
          : "엑셀 파일을 읽을 수 없습니다.";
      setAlert({ title: "파일 읽기 실패", message });
    } finally { setLoading(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  async function decrypt() {
    if (!encrypted || !password) return; setLoading(true);
    let decrypted: Uint8Array;
    try {
      const crypto = (await import("officecrypto-tool")).default;
      decrypted = new Uint8Array(await crypto.decrypt(encrypted.data as never, { password }));
    } catch {
      setAlert({ title: "복호화 실패", message: "비밀번호가 올바르지 않거나 지원하지 않는 암호화 방식입니다." });
      setLoading(false); return;
    }
    try {
      await applyWorkbook(decrypted, encrypted.name);
    } catch (error) {
      const message = error instanceof Error && error.message === "HEADER_MISMATCH"
        ? "비밀번호는 확인됐지만 저장된 가져오기 양식과 이 파일의 헤더가 일치하지 않습니다. 양식에 사용한 은행 파일과 같은 형식인지 확인해주세요."
        : error instanceof Error && error.message === "TOO_MANY"
          ? "비밀번호는 확인됐지만 거래가 500건을 초과해 한 번에 가져올 수 없습니다."
          : error instanceof Error && error.message === "NO_ROWS"
            ? "비밀번호는 확인됐지만 가져올 거래 행이 없습니다."
          : "비밀번호는 확인됐지만 복호화된 엑셀 내용을 읽지 못했습니다.";
      setAlert({ title: "엑셀 내용 확인", message });
    } finally { setLoading(false); }
  }
  function clearSelectedFile() {
    setFileName(""); setPendingRows([]); setEncrypted(null); setPassword("");
    if (inputRef.current) inputRef.current.value = "";
  }
  function applySelectedFile() {
    if (!pendingRows.length) return;
    onParsed(pendingRows); onClose();
  }
  return <section className={`${styles.ledgerImportDialog} ${styles.ledgerImportInline}`} aria-label="엑셀 거래 가져오기">
      <div className={styles.ledgerImportControls}>
        <label>가져오기 양식<select value={profileId} onChange={(e) => { setProfileId(Number(e.target.value)); clearSelectedFile(); }}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.profile_name} · {item.institution_name}</option>)}</select></label>
        <label>계정<select value={accountId} onChange={(e) => { setAccountId(Number(e.target.value)); clearSelectedFile(); }}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.account_name}</option>)}</select></label>
        <div><input ref={inputRef} hidden type="file" accept=".xls,.xlsx" onChange={(e) => void readFile(e.target.files?.[0])} /><button className={styles.secondaryButton} type="button" disabled={!profile || loading} onClick={() => inputRef.current?.click()}>파일 선택</button><span title={fileName}>{fileName || "선택된 파일 없음"}</span><button className={styles.primaryButton} type="button" disabled={!pendingRows.length || loading} onClick={applySelectedFile}>파일 적용</button></div>
      </div>
      {encrypted && <div className={styles.ledgerImportPassword}><label>파일 비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void decrypt(); }} /></label><button type="button" className={styles.primaryButton} onClick={() => void decrypt()}>열기</button></div>}
    <LoadingOverlay active={loading} label="거래 가져오는 중" /><AlertDialog open={!!alert} title={alert?.title ?? ""} message={alert?.message ?? ""} onClose={() => setAlert(null)} />
  </section>;
}
