import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../../api/client";
import { getAssetAccounts, type AssetAccount, type AssetMember } from "../../../../api/assetApi";
import {
  createLedgerTransferLink, deleteLedgerTransaction, deleteLedgerTransferLink,
  getLedgerCategories, getLedgerTransactions, getLedgerTransferCandidates, saveLedgerTransaction,
  type LedgerCategory, type LedgerTransaction,
  type LedgerTransferCandidate,
} from "../../../../api/ledgerApi";
import { AlertDialog, ConfirmDialog } from "../../../../common/dialog";
import { InputField, TextareaField } from "../../../../common/input";
import { LoadingOverlay } from "../../../../common/loading";
import { DataTable, type DataTableColumn } from "../../../../common/table";
import type { LedgerScreenProps } from "../types";
import LedgerCategories from "../settings/LedgerCategories";
import LedgerTransactionSheet from "./LedgerTransactionSheet";
import LedgerImportDialog, { type LedgerImportedRow } from "./LedgerImportDialog";
import styles from "../HouseholdAccounts.module.css";

type Form = {
  id?: number; accountId: number; date: string; time: string; direction: "INFLOW" | "OUTFLOW";
  kind: "INCOME" | "EXPENSE" | "TRANSFER"; amount: string; categoryId: number;
  description: string; counterparty: string; memo: string;
  isReversal: boolean; originalTransactionId: number | null;
};
const today = () => new Date().toLocaleDateString("en-CA");
const currentMonthRange = () => {
  const current = new Date();
  const year = current.getFullYear();
  const month = current.getMonth();
  const format = (date: Date) => {
    const dateYear = date.getFullYear();
    const dateMonth = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${dateYear}-${dateMonth}-${day}`;
  };
  return { startDate: format(new Date(year, month, 1)), endDate: format(new Date(year, month + 1, 0)) };
};
const formattedAmount = (value: string) => {
  if (!value) return "";
  const negative = value.startsWith("-");
  const digits = value.replace(/\D/g, "");
  return digits ? `${negative ? "-" : ""}${BigInt(digits).toLocaleString("ko-KR")}` : negative ? "-" : "";
};

export default function LedgerTransactions({ calendarId, calendarControl }: LedgerScreenProps) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [members, setMembers] = useState<AssetMember[]>([]);
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  const [dateRange, setDateRange] = useState(currentMonthRange);
  const [ownerId, setOwnerId] = useState(0);
  const [canManage, setCanManage] = useState(false); const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LedgerTransaction | null>(null);
  const [transferTarget, setTransferTarget] = useState<LedgerTransaction | null>(null);
  const [transferCandidates, setTransferCandidates] = useState<LedgerTransferCandidate[]>([]);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBatch, setImportBatch] = useState<{ id: number; rows: LedgerImportedRow[] } | null>(null);
  const [categoryWorkspaceLoaded, setCategoryWorkspaceLoaded] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<"transactions" | "categories">("transactions");
  const ledgerAccounts = useMemo(() => accounts.filter((item) => item.is_active && item.is_ledger_enabled), [accounts]);
  const leaves = useMemo(() => categories.filter((item) => item.depth === 3 && item.is_active), [categories]);
  const path = useCallback((leaf: LedgerCategory) => {
    const middle = categories.find((item) => item.id === leaf.parent_id);
    const root = categories.find((item) => item.id === middle?.parent_id);
    return [root?.category_name, middle?.category_name, leaf.category_name].filter(Boolean).join(" > ");
  }, [categories]);

  const load = useCallback(async () => {
    if (!calendarId) return;
    setLoading(true);
    try {
      const accountData = await getAssetAccounts(calendarId);
      const selectedOwnerId = accountData.members.some((member) => member.user_id === ownerId)
        ? ownerId : accountData.currentUserId;
      const [transactionData, categoryData] = await Promise.all([
        getLedgerTransactions(calendarId, dateRange.startDate, dateRange.endDate, selectedOwnerId),
        getLedgerCategories(calendarId),
      ]);
      setTransactions(transactionData.transactions); setCanManage(transactionData.canManage);
      setAccounts(accountData.accounts); setMembers(accountData.members); setCategories(categoryData.categories);
      if (selectedOwnerId !== ownerId) setOwnerId(selectedOwnerId);
    } catch (error) {
      setAlert({ title: "조회 실패", message: error instanceof ApiError ? error.message : "거래내역을 불러오지 못했습니다." });
    } finally { setLoading(false); }
  }, [calendarId, dateRange.endDate, dateRange.startDate, ownerId]);
  useEffect(() => { setForm(null); void load(); }, [load]);

  const refreshCategories = useCallback(async () => {
    try {
      const categoryData = await getLedgerCategories(calendarId);
      setCategories(categoryData.categories);
    } catch (error) {
      setAlert({ title: "분류 새로고침 실패", message: error instanceof ApiError ? error.message : "새 분류를 거래내역에 반영하지 못했습니다." });
    }
  }, [calendarId]);

  function openCategoryWorkspace() {
    setCategoryWorkspaceLoaded(true);
    setActiveWorkspace("categories");
  }

  function start(row?: LedgerTransaction) {
    const firstAccount = ledgerAccounts[0]; const firstLeaf = leaves[0];
    if (!row && (!firstAccount || !firstLeaf)) {
      setAlert({ title: "입력 준비 필요", message: "가계부 사용 계정과 활성 소분류를 먼저 등록해주세요." }); return;
    }
    setForm(row ? {
      id: row.id, accountId: row.account_id, date: row.transaction_date, time: row.transaction_time ?? "",
      direction: row.direction, kind: row.transaction_kind,
      amount: row.transaction_kind === "TRANSFER" && row.direction === "OUTFLOW" ? `-${row.amount}` : row.amount,
      categoryId: row.category_id,
      description: row.description, counterparty: row.counterparty, memo: row.memo,
      isReversal: !!row.is_reversal, originalTransactionId: row.original_transaction_id ?? null,
    } : {
      accountId: firstAccount.id, date: today(), time: "", direction: "OUTFLOW", kind: "EXPENSE",
      amount: "", categoryId: firstLeaf.id, description: "", counterparty: "", memo: "", isReversal: false, originalTransactionId: null,
    });
  }
  async function save() {
    const validAmount = form?.kind === "TRANSFER" ? /^-?[1-9]\d*$/.test(form.amount) : /^[1-9]\d*$/.test(form?.amount ?? "");
    if (!form || !validAmount || !form.description.trim()) {
      setAlert({ title: "입력 확인", message: "금액과 거래내용을 확인해주세요." }); return;
    }
    setSaving(true);
    try {
      await saveLedgerTransaction({
        calendarId, accountId: form.accountId, transactionDate: form.date, transactionTime: form.time || null,
        direction: form.kind === "INCOME" ? (form.isReversal ? "OUTFLOW" : "INFLOW")
          : form.kind === "EXPENSE" ? (form.isReversal ? "INFLOW" : "OUTFLOW")
            : !form.amount.startsWith("-") ? "INFLOW" : "OUTFLOW",
        transactionKind: form.kind, amount: form.amount.replace("-", ""), categoryId: form.categoryId,
        description: form.description, counterparty: form.counterparty, memo: form.memo,
        isReversal: form.kind !== "TRANSFER" && form.isReversal,
        originalTransactionId: form.kind !== "TRANSFER" && form.isReversal ? form.originalTransactionId : null,
      }, form.id);
      setForm(null); await load();
    } catch (error) {
      setAlert({ title: "저장 실패", message: error instanceof ApiError ? error.message : "거래를 저장하지 못했습니다." });
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!removeTarget) return; setSaving(true);
    try { await deleteLedgerTransaction(removeTarget.id); setRemoveTarget(null); setForm(null); await load(); }
    catch (error) { setRemoveTarget(null); setAlert({ title: "삭제 실패", message: error instanceof ApiError ? error.message : "거래를 삭제하지 못했습니다." }); }
    finally { setSaving(false); }
  }
  async function openTransfer(row: LedgerTransaction) {
    try {
      setTransferTarget(row);
      if (!row.transfer_link_id) setTransferCandidates((await getLedgerTransferCandidates(row.id)).candidates);
    } catch (error) {
      setTransferTarget(null);
      setAlert({ title: "이체 연결 조회 실패", message: error instanceof ApiError ? error.message : "이체 후보를 불러오지 못했습니다." });
    }
  }
  async function selectTransfer(candidateId: number) {
    if (!transferTarget) return;
    try { await createLedgerTransferLink(transferTarget.id, candidateId); setTransferTarget(null); setTransferCandidates([]); await load(); }
    catch (error) { setAlert({ title: "이체 연결 실패", message: error instanceof ApiError ? error.message : "이체를 연결하지 못했습니다." }); }
  }
  async function unlinkTransfer() {
    if (!transferTarget?.transfer_link_id) return;
    try { await deleteLedgerTransferLink(transferTarget.transfer_link_id); setTransferTarget(null); await load(); }
    catch (error) { setAlert({ title: "연결 해제 실패", message: error instanceof ApiError ? error.message : "이체 연결을 해제하지 못했습니다." }); }
  }
  const mobileColumns: DataTableColumn<LedgerTransaction>[] = [
    {
      key: "date",
      header: "일자",
      width: 66,
      render: (row) => row.transaction_date.slice(5),
    },
    {
      key: "detail",
      header: "거래내용 · 분류",
      render: (row) => (
        <div className={styles.mobileTransactionDetail}>
          <strong title={row.description}>{row.description}</strong>
          <span title={path(categories.find((item) => item.id === row.category_id)!)}>
            {path(categories.find((item) => item.id === row.category_id)!)}
          </span>
          {row.transaction_kind === "TRANSFER" && <button className={styles.mobileTransferLink} type="button" onClick={(event) => { event.stopPropagation(); void openTransfer(row); }}>
            {row.transfer_link_id ? (row.link_type === "SELF" ? "본인 이체" : "회원 간 이체") : "이체 미연결"}
          </button>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "금액",
      width: 94,
      render: (row) => (
        <div className={styles.mobileTransactionAmount}>
          <span>{row.is_reversal ? `${({ INCOME: "수입", EXPENSE: "지출", TRANSFER: "이체" })[row.transaction_kind]} 취소` : ({ INCOME: "수입", EXPENSE: "지출", TRANSFER: "이체" })[row.transaction_kind]}</span>
          <strong>{BigInt(row.amount).toLocaleString("ko-KR")}원</strong>
        </div>
      ),
    },
  ];
  return (
    <section className={styles.screen}>
      <header className={styles.screenHeader}><h1>거래내역</h1><div className={styles.screenHeaderActions}>
        {calendarControl}
        <select className={styles.filterControl} aria-label="소유자" value={ownerId} onChange={(event) => setOwnerId(Number(event.target.value))}>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select>
        {canManage && <button className={`${styles.primaryButton} ${styles.transactionMobileAction}`} type="button" onClick={() => start()}>직접 입력</button>}
      </div></header>
      <div className={styles.transactionWorkTabs} role="tablist" aria-label="거래내역 작업 탭">
        <button type="button" role="tab" aria-selected={activeWorkspace === "transactions"} className={activeWorkspace === "transactions" ? styles.transactionWorkTabActive : ""} onClick={() => setActiveWorkspace("transactions")}>거래내역</button>
        <button type="button" role="tab" aria-selected={activeWorkspace === "categories"} className={activeWorkspace === "categories" ? styles.transactionWorkTabActive : ""} onClick={openCategoryWorkspace}>분류관리</button>
      </div>
      <div className={activeWorkspace === "transactions" ? styles.transactionWorkspace : styles.transactionWorkspaceHidden}>
      {canManage && <div className={styles.ledgerImportSection}>
        <button type="button" className={styles.ledgerImportToggle} aria-expanded={importOpen} onClick={() => setImportOpen((value) => !value)}>
          <span>엑셀 가져오기</span><i className={importOpen ? styles.ledgerImportToggleOpen : ""} aria-hidden="true" />
        </button>
        <LedgerImportDialog open={importOpen} calendarId={calendarId} accounts={ledgerAccounts} onClose={() => setImportOpen(false)} onParsed={(importRows) => setImportBatch({ id: Date.now(), rows: importRows })} />
      </div>}
      <LedgerTransactionSheet calendarId={calendarId} rows={transactions} accounts={ledgerAccounts} categories={categories} canManage={canManage} onReload={load} importBatch={importBatch} onImportApplied={() => setImportBatch(null)} startDate={dateRange.startDate} endDate={dateRange.endDate} onDateRangeChange={(startDate, endDate) => setDateRange({ startDate, endDate })} />
      <div className={`${styles.managementGrid} ${styles.transactionMobile} ${form ? styles.managementGridEditing : ""}`}>
        <div className={styles.tableSection}><DataTable className={styles.mobileTransactionTable} ariaLabel="가계부 거래내역" columns={mobileColumns} rows={transactions} getRowKey={(row) => row.id} emptyMessage="조회된 거래가 없습니다." onRowClick={(row) => canManage && start(row)} /></div>
        {form && <aside className={styles.editorPanel}><header className={styles.editorHeader}><h2>{form.id ? "거래 수정" : "거래 입력"}</h2><button type="button" onClick={() => setForm(null)}>×</button></header>
          <div className={styles.formFields}>
            <label>계정<select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: Number(e.target.value) })}>{ledgerAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</select></label>
            <InputField label="거래일" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <InputField label="시간" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <label>거래 성격<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Form["kind"], isReversal: false, originalTransactionId: null })}><option value="INCOME">수입</option><option value="EXPENSE">지출</option><option value="TRANSFER">계좌이체</option></select></label>
            {form.kind !== "TRANSFER" && <label className={styles.importActiveField}><input type="checkbox" checked={form.isReversal} onChange={(e) => setForm({ ...form, isReversal: e.target.checked, originalTransactionId: null })} />취소 거래</label>}
            {form.kind !== "TRANSFER" && form.isReversal && <label>원거래(선택)<select value={form.originalTransactionId ?? 0} onChange={(e) => setForm({ ...form, originalTransactionId: Number(e.target.value) || null })}><option value={0}>연결 안 함</option>{transactions.filter((item) => !item.is_reversal && item.transaction_kind === form.kind && item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.transaction_date} · {item.description} · {BigInt(item.amount).toLocaleString("ko-KR")}원</option>)}</select></label>}
            <InputField label={form.kind === "TRANSFER" ? "금액 (+입금 / -출금)" : "금액"} inputMode={form.kind === "TRANSFER" ? "decimal" : "numeric"} value={formattedAmount(form.amount)} onChange={(e) => setForm({ ...form, amount: form.kind === "TRANSFER" ? (e.target.value.startsWith("-") ? `-${e.target.value.replace(/\D/g, "")}` : e.target.value.replace(/\D/g, "")) : e.target.value.replace(/\D/g, "") })} />
            <label>소분류<select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>{leaves.map((leaf) => <option key={leaf.id} value={leaf.id}>{path(leaf)}</option>)}</select></label>
            <InputField label="거래내용" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <InputField label="거래처명" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
            <TextareaField label="메모" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </div><footer className={styles.editorActions}>{form.id && <button className={styles.deleteButton} type="button" onClick={() => setRemoveTarget(transactions.find((t) => t.id === form.id) ?? null)}>삭제</button>}<button className={styles.secondaryButton} type="button" onClick={() => setForm(null)}>취소</button><button className={styles.primaryButton} type="button" disabled={saving} onClick={() => void save()}>저장</button></footer></aside>}
      </div>
      </div>
      {categoryWorkspaceLoaded && <div className={activeWorkspace === "categories" ? styles.categoryWorkspace : styles.transactionWorkspaceHidden}>
        <LedgerCategories calendarId={calendarId} calendarName="" calendarControl={calendarControl} embedded onCategoriesChanged={refreshCategories} />
      </div>}
      <LoadingOverlay active={loading} label="거래내역 로딩 중" />
      <ConfirmDialog open={!!removeTarget} title="거래 삭제" message="이 거래를 삭제하시겠습니까?" cancelLabel="취소" confirmLabel="삭제" onClose={() => setRemoveTarget(null)} onConfirm={() => void remove()} />
      <ConfirmDialog
        open={!!transferTarget?.transfer_link_id}
        title="이체 연결 정보"
        message={`${transferTarget?.link_type === "SELF" ? "본인 계좌 간 이체" : "캘린더 회원 간 이체"}입니다. 연결을 해제하시겠습니까?`}
        cancelLabel="닫기" confirmLabel="연결 해제"
        onClose={() => setTransferTarget(null)} onConfirm={() => void unlinkTransfer()}
      />
      {!transferTarget?.transfer_link_id && transferTarget && <div className={styles.mobileTransferCandidateOverlay} role="dialog" aria-label="이체 연결">
        <div><header><strong>이체 연결</strong><button type="button" onClick={() => { setTransferTarget(null); setTransferCandidates([]); }}>×</button></header>
          {transferCandidates.length ? transferCandidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => void selectTransfer(candidate.id)}>
            <strong>{candidate.transactionDate} · {candidate.ownerName}</strong><span>{candidate.accountName} · {BigInt(candidate.amount).toLocaleString("ko-KR")}원 · {candidate.linkType === "SELF" ? "본인" : "회원 간"}</span>
          </button>) : <p>날짜가 3일 이내이고 금액이 같은 반대 방향 이체가 없습니다.</p>}
        </div>
      </div>}
      <AlertDialog open={!!alert} title={alert?.title ?? ""} message={alert?.message ?? ""} onClose={() => setAlert(null)} />
    </section>
  );
}
