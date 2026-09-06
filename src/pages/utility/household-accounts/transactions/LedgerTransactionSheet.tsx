import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Button, ClickAwayListener, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Popper,
} from "@mui/material";
import { ApiError } from "../../../../api/client";
import type { AssetAccount } from "../../../../api/assetApi";
import {
  createLedgerTransferLink,
  classifyLedgerTransactions,
  deleteLedgerTransaction,
  deleteLedgerTransferLink,
  getLedgerTransferCandidates,
  saveLedgerTransaction,
  type LedgerCategory,
  type LedgerTransferCandidate,
  type LedgerTransaction,
  type LedgerTransactionPayload,
} from "../../../../api/ledgerApi";
import { AlertDialog, ConfirmDialog } from "../../../../common/dialog";
import type { LedgerImportedRow } from "./LedgerImportDialog";
import styles from "../HouseholdAccounts.module.css";

type Draft = {
  key: string; id?: number; checked: boolean; dirty: boolean;
  accountId: number; date: string; income: string; expense: string; transfer: string;
  categoryId: number; categoryQuery: string; description: string; counterparty: string; memo: string;
  isReversal: boolean; originalTransactionId: number | null;
  time: string | null;
  entrySource: "MANUAL" | "EXCEL";
  duplicateStatus: "NONE" | "EXACT" | "SUSPECTED";
  classificationConflict: boolean;
  classificationSource: "MANUAL" | "RULE";
};
type Props = {
  calendarId: number; rows: LedgerTransaction[]; accounts: AssetAccount[];
  categories: LedgerCategory[]; canManage: boolean; onReload: () => Promise<void>;
  importBatch?: { id: number; rows: LedgerImportedRow[] } | null; onImportApplied?: () => void;
  startDate: string; endDate: string; onDateRangeChange: (startDate: string, endDate: string) => void;
};
type AmountField = "income" | "expense" | "transfer";
const digits = (value: string) => value.replace(/[^\d]/g, "");
const signed = (value: string) => {
  const negative = value.trim().startsWith("-");
  const valueDigits = digits(value);
  return valueDigits ? `${negative ? "-" : ""}${valueDigits}` : negative ? "-" : "";
};
const formattedAmount = (value: string) => {
  if (!value) return "";
  const negative = value.startsWith("-");
  const valueDigits = digits(value);
  if (!valueDigits) return negative ? "-" : "";
  return `${negative ? "-" : ""}${BigInt(valueDigits).toLocaleString("ko-KR")}`;
};
const time24 = (value: string) => {
  const valueDigits = value.replace(/\D/g, "").slice(0, 4);
  return valueDigits.length <= 2 ? valueDigits : `${valueDigits.slice(0, 2)}:${valueDigits.slice(2)}`;
};

function toDraft(row: LedgerTransaction, categoryName = row.category_name): Draft {
  return {
    key: `saved-${row.id}`, id: row.id, checked: false, dirty: false,
    accountId: row.account_id, date: row.transaction_date,
    income: row.transaction_kind === "INCOME" ? row.amount : "",
    expense: row.transaction_kind === "EXPENSE" ? row.amount : "",
    transfer: row.transaction_kind === "TRANSFER"
      ? `${row.direction === "OUTFLOW" ? "-" : ""}${row.amount}` : "",
    categoryId: row.category_id, categoryQuery: categoryName,
    description: row.description, counterparty: row.counterparty, memo: row.memo ?? "",
    isReversal: !!row.is_reversal, originalTransactionId: row.original_transaction_id ?? null,
    time: row.transaction_time,
    entrySource: row.entry_source ?? "MANUAL",
    duplicateStatus: "NONE",
    classificationConflict: false,
    classificationSource: row.classification_source ?? "MANUAL",
  };
}

export default function LedgerTransactionSheet({ calendarId, rows, accounts, categories, canManage, onReload, importBatch, onImportApplied, startDate, endDate, onDateRangeChange }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [categoryCandidates, setCategoryCandidates] = useState<LedgerCategory[]>([]);
  const [categoryTargetKey, setCategoryTargetKey] = useState("");
  const [openCategoryKey, setOpenCategoryKey] = useState("");
  const [showAllCategoryKey, setShowAllCategoryKey] = useState("");
  const [categoryAnchor, setCategoryAnchor] = useState<HTMLElement | null>(null);
  const suppressCategoryFocus = useRef("");
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [pendingAmountChange, setPendingAmountChange] = useState<{
    key: string;
    field: AmountField;
    value: string;
  } | null>(null);
  const [transferTarget, setTransferTarget] = useState<LedgerTransaction | null>(null);
  const [transferCandidates, setTransferCandidates] = useState<LedgerTransferCandidate[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  useEffect(() => setDrafts(rows.map((row) => toDraft(row))), [rows]);
  useEffect(() => {
    setDrafts((current) => current.map((row) => {
      const categoryName = categories.find((item) => item.id === row.categoryId)?.category_name;
      return categoryName && row.categoryQuery !== categoryName
        ? { ...row, categoryQuery: categoryName }
        : row;
    }));
  }, [categories]);
  useEffect(() => {
    if (!importBatch?.rows.length) return;
    setDrafts((current) => [...importBatch.rows.map((row, index): Draft => ({
      key: `import-${importBatch.id}-${index}`, checked: false, dirty: row.duplicateStatus !== "EXACT",
      accountId: row.accountId, date: row.transactionDate, time: row.transactionTime,
      income: row.classification === "INCOME" || row.classification === "INCOME_REVERSAL" ? row.amount : "",
      expense: row.classification === "EXPENSE" || row.classification === "EXPENSE_REVERSAL" ? row.amount : "",
      transfer: row.classification === "TRANSFER" ? `${row.direction === "OUTFLOW" ? "-" : ""}${row.amount}` : "",
      categoryId: row.categoryId, categoryQuery: categories.find((item) => item.id === row.categoryId)?.category_name ?? "",
      description: row.description, counterparty: row.counterparty, memo: row.memo,
      isReversal: row.classification === "INCOME_REVERSAL" || row.classification === "EXPENSE_REVERSAL",
      originalTransactionId: null,
      entrySource: "EXCEL",
      duplicateStatus: row.duplicateStatus,
      classificationConflict: row.classificationConflict,
      classificationSource: row.classificationSource,
    })), ...current]);
    onImportApplied?.();
  }, [categories, importBatch, onImportApplied]);

  const roots = useMemo(() => new Map(categories.filter((item) => item.depth === 1).map((item) => [item.id, item])), [categories]);
  const middles = useMemo(() => new Map(categories.filter((item) => item.depth === 2).map((item) => [item.id, item])), [categories]);
  const leaves = useMemo(() => categories.filter((item) => item.depth === 3 && item.is_active), [categories]);
  const leafNames = useMemo(() => [...new Set(leaves.map((item) => item.category_name))].sort((a, b) => a.localeCompare(b, "ko")), [leaves]);
  const categoryPath = (categoryId: number) => {
    const leaf = categories.find((item) => item.id === categoryId);
    const middle = leaf ? middles.get(leaf.parent_id ?? 0) : undefined;
    const root = middle ? roots.get(middle.parent_id ?? 0) : undefined;
    return { root: root?.category_name ?? "", middle: middle?.category_name ?? "", leaf: leaf?.category_name ?? "" };
  };
  const change = (key: string, values: Partial<Draft>) => setDrafts((current) => current.map((row) => row.key === key ? {
    ...row, ...values, dirty: true,
    classificationSource: values.categoryId !== undefined ? "MANUAL" : row.classificationSource,
    classificationConflict: values.categoryId !== undefined ? false : row.classificationConflict,
  } : row));
  const checked = drafts.filter((row) => row.checked);
  const filteredDrafts = drafts.filter((row) => {
    const query = searchQuery.trim().toLocaleLowerCase("ko");
    if (!query) return true;
    const path = categoryPath(row.categoryId);
    const accountName = accounts.find((account) => account.id === row.accountId)?.account_name ?? "";
    return [row.date, row.time ?? "", accountName, path.root, path.middle, path.leaf,
      row.description, row.counterparty, row.memo, row.income, row.expense, row.transfer]
      .some((value) => value.toLocaleLowerCase("ko").includes(query));
  });

  function applyAmountChange(key: string, field: AmountField, value: string) {
    change(key, {
      income: field === "income" ? value : "",
      expense: field === "expense" ? value : "",
      transfer: field === "transfer" ? value : "",
      ...(field === "transfer" && value ? { isReversal: false, originalTransactionId: null } : {}),
    });
  }

  function requestAmountChange(row: Draft, field: AmountField, input: string) {
    const value = field === "transfer" ? signed(input) : digits(input);
    const hasOtherAmount = (field !== "income" && !!row.income)
      || (field !== "expense" && !!row.expense)
      || (field !== "transfer" && !!row.transfer);
    if (hasOtherAmount && value) {
      setPendingAmountChange({ key: row.key, field, value });
      return;
    }
    applyAmountChange(row.key, field, value);
  }

  async function recommendCategory(row: Draft) {
    if (row.categoryId || (!row.description.trim() && !row.memo.trim())) return;
    try {
      const result = await classifyLedgerTransactions(calendarId, [{
        description: row.description, memo: row.memo,
      }]);
      const categoryId = result.results[0]?.categoryId;
      if (result.results[0]?.status === "CONFLICT") {
        setDrafts((current) => current.map((item) => item.key === row.key
          ? { ...item, classificationConflict: true }
          : item));
        return;
      }
      const category = categories.find((item) => item.id === categoryId);
      if (!category || category.depth !== 3) return;
      setDrafts((current) => current.map((item) => item.key === row.key && !item.categoryId ? {
        ...item, categoryId: category.id, categoryQuery: category.category_name,
        classificationSource: "RULE", dirty: true,
      } : item));
    } catch {
      // 추천 실패는 직접 입력을 막지 않으며 저장 시 서버 검증은 그대로 수행한다.
    }
  }

  function addRow() {
    if (!accounts[0] || !leaves[0]) {
      setAlert({ title: "입력 준비 필요", message: "가계부 사용 계정과 활성 소분류를 먼저 등록해주세요." }); return;
    }
    setDrafts((current) => [{
      key: `new-${nextKey}`, checked: false, dirty: true, accountId: accounts[0].id,
      date: new Date().toLocaleDateString("en-CA"), income: "", expense: "", transfer: "",
      categoryId: 0, categoryQuery: "",
      description: "", counterparty: "", memo: "", isReversal: false, originalTransactionId: null,
      time: null,
      entrySource: "MANUAL",
      duplicateStatus: "NONE",
      classificationConflict: false,
      classificationSource: "MANUAL",
    }, ...current]);
    setNextKey((value) => value + 1);
  }

  function chooseLeafName(key: string, name: string) {
    const normalized = name.trim().toLocaleLowerCase("ko");
    const matches = leaves.filter((item) =>
      item.category_name.trim().toLocaleLowerCase("ko") === normalized);
    if (matches.length === 1) change(key, {
      categoryId: matches[0].id,
      categoryQuery: matches[0].category_name,
    });
    else if (matches.length > 1) {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setOpenCategoryKey("");
      setCategoryAnchor(null);
      setShowAllCategoryKey("");
      setCategoryTargetKey(key);
      setCategoryCandidates(matches);
    } else if (name.trim()) {
      setAlert({
        title: "소분류 확인",
        message: "등록된 활성 소분류명을 입력해주세요.",
      });
      const current = categoryPath(drafts.find((item) => item.key === key)?.categoryId ?? 0);
      change(key, { categoryQuery: current.leaf });
    }
  }

  function cancelCategoryChoice() {
    if (categoryTargetKey) {
      suppressCategoryFocus.current = categoryTargetKey;
      change(categoryTargetKey, { categoryId: 0, categoryQuery: "" });
    }
    setCategoryCandidates([]);
    setCategoryTargetKey("");
    setOpenCategoryKey("");
    setCategoryAnchor(null);
    setShowAllCategoryKey("");
  }

  function selectCategoryChoice(leaf: LedgerCategory) {
    suppressCategoryFocus.current = categoryTargetKey;
    change(categoryTargetKey, {
      categoryId: leaf.id,
      categoryQuery: leaf.category_name,
    });
    setCategoryCandidates([]);
    setCategoryTargetKey("");
    setOpenCategoryKey("");
    setCategoryAnchor(null);
    setShowAllCategoryKey("");
  }

  function closeCategorySearch(key: string) {
    const current = drafts.find((row) => row.key === key);
    if (current) {
      const committedName = categories.find((item) => item.id === current.categoryId)?.category_name ?? "";
      setDrafts((items) => items.map((item) =>
        item.key === key ? { ...item, categoryQuery: committedName } : item));
    }
    setOpenCategoryKey("");
    setCategoryAnchor(null);
    setShowAllCategoryKey("");
  }

  function cancelChecked() {
    if (!checked.length) return;
    const original = new Map(rows.map((row) => [row.id, toDraft(
      row,
      categories.find((item) => item.id === row.category_id)?.category_name,
    )]));
    setDrafts((current) => current.flatMap((row) => {
      if (!row.checked) return [row];
      if (!row.id) return [];
      return [{ ...original.get(row.id)!, checked: false }];
    }));
  }

  function payload(row: Draft): LedgerTransactionPayload | null {
    const entered = [row.income, row.expense, row.transfer].filter((value) => value !== "");
    if (entered.length !== 1 || !row.description.trim() || row.categoryId <= 0) return null;
    if (row.income && !/^[1-9]\d*$/.test(row.income)) return null;
    if (row.expense && !/^[1-9]\d*$/.test(row.expense)) return null;
    if (row.transfer && !/^-?[1-9]\d*$/.test(row.transfer)) return null;
    const kind = row.income ? "INCOME" : row.expense ? "EXPENSE" : "TRANSFER";
    if (kind === "TRANSFER" && row.isReversal) return null;
    const rawAmount = row.income || row.expense || row.transfer;
    return {
      calendarId, accountId: row.accountId, transactionDate: row.date, transactionTime: row.time,
      transactionKind: kind, direction: kind === "INCOME" ? (row.isReversal ? "OUTFLOW" : "INFLOW")
        : kind === "EXPENSE" ? (row.isReversal ? "INFLOW" : "OUTFLOW")
          : !rawAmount.startsWith("-") ? "INFLOW" : "OUTFLOW",
      amount: rawAmount.replace("-", ""), categoryId: row.categoryId,
      description: row.description, counterparty: row.counterparty, memo: row.memo,
      isReversal: row.isReversal, originalTransactionId: row.isReversal ? row.originalTransactionId : null,
      entrySource: row.entrySource,
      allowDuplicate: row.duplicateStatus === "SUSPECTED",
      classificationSource: row.classificationSource,
    };
  }

  async function saveAll() {
    const dirty = drafts.filter((row) => row.dirty && row.duplicateStatus !== "EXACT");
    if (!dirty.length) return;
    const inputs = dirty.map((row) => ({ row, payload: payload(row) }));
    if (inputs.some((item) => !item.payload)) {
      setAlert({ title: "입력 확인", message: "각 행의 소분류·거래내용과 수입·지출·이체 중 하나의 0이 아닌 금액을 입력해주세요." }); return;
    }
    setSaving(true);
    try {
      for (const item of inputs) await saveLedgerTransaction(item.payload!, item.row.id);
      await onReload();
    } catch (error) {
      setAlert({ title: "저장 실패", message: error instanceof ApiError ? error.message : "거래를 저장하지 못했습니다." });
    } finally { setSaving(false); }
  }

  async function removeChecked() {
    const saved = checked.filter((row) => row.id);
    setSaving(true);
    try {
      for (const row of saved) await deleteLedgerTransaction(row.id!);
      setDeleteOpen(false); await onReload();
    } catch (error) {
      setDeleteOpen(false);
      setAlert({ title: "삭제 실패", message: error instanceof ApiError ? error.message : "거래를 삭제하지 못했습니다." });
    } finally { setSaving(false); }
  }

  async function openTransferLink(row: LedgerTransaction) {
    if (row.transfer_link_id) {
      setTransferTarget(row);
      setTransferCandidates([]);
      return;
    }
    setTransferLoading(true);
    try {
      const result = await getLedgerTransferCandidates(row.id);
      setTransferTarget(row);
      setTransferCandidates(result.candidates);
    } catch (error) {
      setAlert({ title: "이체 연결 조회 실패", message: error instanceof ApiError ? error.message : "이체 후보를 불러오지 못했습니다." });
    } finally { setTransferLoading(false); }
  }

  async function linkTransfer(candidateId: number) {
    if (!transferTarget) return;
    setTransferLoading(true);
    try {
      await createLedgerTransferLink(transferTarget.id, candidateId);
      setTransferTarget(null); setTransferCandidates([]); await onReload();
    } catch (error) {
      setAlert({ title: "이체 연결 실패", message: error instanceof ApiError ? error.message : "이체를 연결하지 못했습니다." });
    } finally { setTransferLoading(false); }
  }

  async function unlinkTransfer() {
    if (!transferTarget?.transfer_link_id) return;
    setTransferLoading(true);
    try {
      await deleteLedgerTransferLink(transferTarget.transfer_link_id);
      setTransferTarget(null); await onReload();
    } catch (error) {
      setAlert({ title: "연결 해제 실패", message: error instanceof ApiError ? error.message : "이체 연결을 해제하지 못했습니다." });
    } finally { setTransferLoading(false); }
  }

  return (
    <>
      <div className={styles.transactionSheetToolbar}>
        <div className={styles.transactionSheetFilters}>
        <div className={styles.transactionDateRange}>
          <label><span></span><input aria-label="거래 시작일" type="date" value={startDate} max={endDate} onChange={(event) => event.target.value && onDateRangeChange(event.target.value, endDate)} /></label>
          <i>~</i>
          <label><span></span><input aria-label="거래 종료일" type="date" value={endDate} min={startDate} onChange={(event) => event.target.value && onDateRangeChange(startDate, event.target.value)} /></label>
        </div>
        <div className={styles.transactionSheetSearch}>
          <input
            type="search"
            aria-label="거래내역 검색"
            placeholder="거래내역 검색"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setDrafts((current) => current.map((row) => row.checked ? { ...row, checked: false } : row));
            }}
          />
          <span aria-hidden="true" />
        </div>
        </div>
        <div className={styles.transactionSheetActions}>
        {canManage && <button type="button" className={styles.secondaryButton} onClick={addRow}>+ 행 추가</button>}
        <button type="button" className={styles.secondaryButton} disabled={!checked.length} onClick={cancelChecked}>취소</button>
        <button type="button" className={styles.deleteButton} disabled={!checked.some((row) => row.id)} onClick={() => setDeleteOpen(true)}>삭제</button>
        <button type="button" className={styles.primaryButton} disabled={saving || !drafts.some((row) => row.dirty && row.duplicateStatus !== "EXACT")} onClick={() => void saveAll()}>저장</button>
        </div>
      </div>
      <div className={`${styles.transactionSheet} ${styles.transactionDesktop}`}>
        <table>
          <thead>
            <tr>
              <th className={styles.transactionCheckColumn}>
                <input
                  type="checkbox"
                  aria-label="거래 전체 선택"
                  disabled={!canManage || !filteredDrafts.length}
                  checked={filteredDrafts.length > 0 && filteredDrafts.every((row) => row.checked)}
                  onChange={(event) => {
                    const visibleKeys = new Set(filteredDrafts.map((row) => row.key));
                    setDrafts((current) => current.map((row) => visibleKeys.has(row.key) ? { ...row, checked: event.target.checked } : row));
                  }}
                />
              </th>
              <th className={styles.transactionStatusColumn}>상태</th>
              <th className={styles.transactionDateColumn}>일자</th>
              <th className={styles.transactionTimeColumn}>시간</th>
              <th>계정</th>
              <th>소분류</th>
              <th className={styles.transactionAmountColumn}>수입</th>
              <th className={styles.transactionAmountColumn}>지출</th>
              <th className={styles.transactionAmountColumn}>이체</th>
              <th className={styles.transactionDescriptionColumn}>거래내용</th>
              <th>거래처명</th>
              <th>메모</th>
              <th className={styles.transactionDetailColumn}>상세</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrafts.map((row) => {
              const path = categoryPath(row.categoryId);
              const hasIssue = row.duplicateStatus !== "NONE" || row.classificationConflict;
              const issueText = row.duplicateStatus === "EXACT" ? "완전 중복 거래입니다."
                : row.classificationConflict ? "여러 자동분류 문구가 서로 다른 소분류와 일치합니다."
                  : row.duplicateStatus === "SUSPECTED" ? "기존 거래와 유사하여 확인이 필요합니다." : "이상 없음";
              const saved = row.id ? rows.find((item) => item.id === row.id) : undefined;
              return <Fragment key={row.key}><tr className={row.duplicateStatus === "EXACT" ? styles.sheetExactDuplicateRow : row.dirty ? styles.sheetDirtyRow : ""}>
                <td className={styles.sheetCheckboxCell}><input type="checkbox" aria-label="거래 선택" disabled={!canManage} checked={row.checked} onChange={(event) => setDrafts((current) => current.map((item) => item.key === row.key ? { ...item, checked: event.target.checked } : item))} /></td>
                <td className={styles.duplicateStatusCell}>{hasIssue && <button type="button" className={styles.transactionIssueButton} aria-label={issueText} title={issueText} onClick={() => setExpandedKey((current) => current === row.key ? "" : row.key)}>!</button>}</td>
                <td className={styles.transactionDateColumn}><input type="date" disabled={!canManage} value={row.date} onChange={(e) => change(row.key, { date: e.target.value })} /></td>
                <td><input type="text" inputMode="numeric" maxLength={5} aria-label="거래 시간" placeholder="HH:mm" disabled={!canManage} value={row.time ?? ""} onChange={(e) => change(row.key, { time: time24(e.target.value) || null })} /></td>
                <td><select className={styles.transactionDropdownControl} disabled={!canManage} value={row.accountId} onChange={(e) => change(row.key, { accountId: Number(e.target.value) })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}</select></td>
                <td className={styles.categoryComboCell}>
                  <div className={styles.categoryCombo}>
                    <input
                      className={styles.transactionDropdownControl}
                      disabled={!canManage}
                      value={row.categoryQuery}
                      placeholder="소분류 입력"
                      onMouseDown={(event) => event.stopPropagation()}
                      onFocus={(event) => {
                        if (suppressCategoryFocus.current === row.key) {
                          suppressCategoryFocus.current = "";
                          return;
                        }
                        setCategoryAnchor(event.currentTarget.parentElement);
                        setOpenCategoryKey(row.key);
                      }}
                      onChange={(event) => {
                        change(row.key, { categoryQuery: event.target.value });
                        setOpenCategoryKey(row.key);
                        setCategoryAnchor(event.currentTarget.parentElement);
                        setShowAllCategoryKey("");
                      }}
                      onBlur={() => closeCategorySearch(row.key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          chooseLeafName(row.key, event.currentTarget.value);
                          setOpenCategoryKey("");
                          setCategoryAnchor(null);
                        }
                        if (event.key === "Escape") {
                          setOpenCategoryKey("");
                          setCategoryAnchor(null);
                        }
                      }}
                    />
                  </div>
                </td>
                <td><input disabled={!canManage} inputMode="numeric" value={formattedAmount(row.income)} onChange={(e) => requestAmountChange(row, "income", e.target.value)} /></td>
                <td><input disabled={!canManage} inputMode="numeric" value={formattedAmount(row.expense)} onChange={(e) => requestAmountChange(row, "expense", e.target.value)} /></td>
                <td><input disabled={!canManage} inputMode="decimal" placeholder="+입금 / -출금" value={formattedAmount(row.transfer)} onChange={(e) => requestAmountChange(row, "transfer", e.target.value)} /></td>
                <td className={styles.transactionDescriptionColumn}><input disabled={!canManage} value={row.description} onChange={(e) => change(row.key, { description: e.target.value })} onBlur={() => void recommendCategory(row)} /></td>
                <td><input disabled={!canManage} value={row.counterparty} onChange={(e) => change(row.key, { counterparty: e.target.value })} onBlur={() => void recommendCategory(row)} /></td>
                <td><input disabled={!canManage} value={row.memo} onChange={(e) => change(row.key, { memo: e.target.value })} onBlur={() => void recommendCategory(row)} /></td>
                <td className={styles.transactionDetailColumn}><button type="button" className={styles.transactionDetailButton} aria-expanded={expandedKey === row.key} onClick={() => setExpandedKey((current) => current === row.key ? "" : row.key)}>{expandedKey === row.key ? "접기" : "상세"}</button></td>
              </tr>
              <tr className={`${styles.transactionDetailRow} ${expandedKey === row.key ? styles.transactionDetailRowOpen : ""}`} aria-hidden={expandedKey !== row.key}>
                <td colSpan={13}>
                  <div className={styles.transactionDetailCollapse}>
                  <div className={styles.transactionDetailContent}>
                  <div className={styles.transactionDetailGrid}>
                    <div><span>상태</span><strong className={hasIssue ? styles.transactionDetailIssue : ""}>{issueText}</strong></div>
                    <div><span>대분류</span><strong>{path.root || "-"}</strong></div>
                    <div><span>중분류</span><strong>{path.middle || "-"}</strong></div>
                    <label className={styles.transactionDetailCheck}><span>취소</span><input type="checkbox" aria-label="취소 거래" disabled={!canManage || !!row.transfer} checked={row.isReversal} onChange={(event) => change(row.key, { isReversal: event.target.checked, originalTransactionId: null })} /></label>
                    <label><span>원거래</span><select className={styles.transactionDropdownControl} disabled={!canManage || !row.isReversal} value={row.originalTransactionId ?? 0} onChange={(event) => change(row.key, { originalTransactionId: Number(event.target.value) || null })}><option value={0}>연결 안 함</option>{rows.filter((item) => item.id !== row.id && !item.is_reversal && ((row.income && item.transaction_kind === "INCOME") || (row.expense && item.transaction_kind === "EXPENSE"))).map((item) => <option key={item.id} value={item.id}>{item.transaction_date} · {item.description} · {BigInt(item.amount).toLocaleString("ko-KR")}원</option>)}</select></label>
                    <div className={styles.transferLinkCell}><span>이체 연결</span>{!saved || saved.transaction_kind !== "TRANSFER" ? <strong>-</strong> : <button type="button" disabled={!canManage || row.dirty || transferLoading} onClick={() => void openTransferLink(saved)}>{saved.transfer_link_id ? (saved.link_type === "SELF" ? "본인 이체" : "회원 간 이체") : "미연결"}</button>}</div>
                    <div><span>입력 경로</span><strong>{row.entrySource === "EXCEL" ? "엑셀" : "직접 입력"}</strong></div>
                    <div><span>분류 방식</span><strong>{row.classificationSource === "RULE" ? "자동분류" : "직접 지정"}</strong></div>
                  </div>
                  </div>
                  </div>
                </td>
              </tr>
              </Fragment>;
            })}
            {!filteredDrafts.length && <tr><td colSpan={13} className={styles.sheetEmptyCell}>{searchQuery.trim() ? "검색 결과가 없습니다." : "조회된 거래가 없습니다."}</td></tr>}
          </tbody>
        </table>
      </div>
      <Popper
        open={!!openCategoryKey && !!categoryAnchor}
        anchorEl={categoryAnchor}
        placement="bottom-start"
        sx={{ zIndex: 19000 }}
      >
        <ClickAwayListener
          mouseEvent="onMouseDown"
          touchEvent="onTouchStart"
          onClickAway={() => {
            if (openCategoryKey) closeCategorySearch(openCategoryKey);
          }}
        >
          <Paper
            className={styles.categoryComboMenu}
            elevation={0}
            sx={{ width: categoryAnchor?.getBoundingClientRect().width ?? 180 }}
          >
            {(() => {
              const current = drafts.find((row) => row.key === openCategoryKey);
              if (!current) return null;
              const matches = leafNames.filter((name) =>
                showAllCategoryKey === current.key
                || name.toLocaleLowerCase("ko").includes(
                  current.categoryQuery.trim().toLocaleLowerCase("ko"),
                ));
              return matches.length ? matches.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    chooseLeafName(current.key, name);
                    setOpenCategoryKey("");
                    setCategoryAnchor(null);
                  }}
                >
                  {name}
                </button>
              )) : <span>일치하는 소분류가 없습니다.</span>;
            })()}
          </Paper>
        </ClickAwayListener>
      </Popper>
      <ConfirmDialog open={deleteOpen} title="거래 삭제" message={`선택한 저장 거래 ${checked.filter((row) => row.id).length}건을 삭제하시겠습니까?`} cancelLabel="취소" confirmLabel="삭제" onClose={() => setDeleteOpen(false)} onConfirm={() => void removeChecked()} />
      <ConfirmDialog
        open={!!pendingAmountChange}
        title="금액 항목 변경"
        message="다른 금액 항목에 입력된 기존 데이터가 삭제됩니다. 계속하시겠습니까?"
        cancelLabel="취소"
        confirmLabel="계속"
        onClose={() => setPendingAmountChange(null)}
        onConfirm={() => {
          if (pendingAmountChange) {
            applyAmountChange(
              pendingAmountChange.key,
              pendingAmountChange.field,
              pendingAmountChange.value,
            );
          }
          setPendingAmountChange(null);
        }}
      />
      <Dialog
        open={categoryCandidates.length > 0}
        onClose={cancelCategoryChoice}
        disableRestoreFocus
        maxWidth="sm"
        fullWidth
        sx={{
          zIndex: 20000,
          "& .MuiDialog-paper": {
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            boxShadow: "0 20px 50px rgb(0 0 0 / 35%)",
          },
          "& .MuiDialogTitle-root": {
            borderBottom: "1px solid var(--color-border)",
            fontFamily: "inherit",
            fontSize: "17px",
            fontWeight: 900,
          },
          "& .MuiDialogContent-root": { padding: 0 },
          "& .MuiDialogActions-root": {
            borderTop: "1px solid var(--color-border)",
            padding: "10px 16px",
          },
        }}
      >
        <DialogTitle>소분류 선택</DialogTitle>
        <DialogContent><div className={styles.categoryChoiceSheet}><table><thead><tr><th>대분류</th><th>중분류</th><th>소분류</th></tr></thead><tbody>{categoryCandidates.map((leaf) => {
          const path = categoryPath(leaf.id);
          return <tr key={leaf.id} onClick={() => selectCategoryChoice(leaf)}><td>{path.root}</td><td>{path.middle}</td><td>{path.leaf}</td></tr>;
        })}</tbody></table></div></DialogContent>
        <DialogActions><Button onClick={cancelCategoryChoice}>취소</Button></DialogActions>
      </Dialog>
      <Dialog
        open={!!transferTarget}
        onClose={() => { if (!transferLoading) { setTransferTarget(null); setTransferCandidates([]); } }}
        maxWidth="sm"
        fullWidth
        sx={{
          zIndex: 20000,
          "& .MuiDialog-paper": {
            border: "1px solid var(--color-border)", borderRadius: "10px",
            background: "var(--color-surface)", color: "var(--color-text)",
          },
          "& .MuiDialogTitle-root": { borderBottom: "1px solid var(--color-border)", fontFamily: "inherit", fontSize: "17px", fontWeight: 900 },
          "& .MuiDialogContent-root": { padding: 0 },
          "& .MuiDialogActions-root": { borderTop: "1px solid var(--color-border)", padding: "10px 16px" },
        }}
      >
        <DialogTitle>{transferTarget?.transfer_link_id ? "이체 연결 정보" : "이체 연결"}</DialogTitle>
        <DialogContent>
          {transferTarget?.transfer_link_id
            ? <div className={styles.transferLinkSummary}>
                <strong>{transferTarget.link_type === "SELF" ? "본인 계좌 간 이체" : "캘린더 회원 간 이체"}</strong>
                <span>연결 거래 코드 {transferTarget.linked_transaction_id}</span>
              </div>
            : transferCandidates.length
              ? <div className={styles.categoryChoiceSheet}><table><thead><tr><th>일자</th><th>소유자</th><th>계정</th><th>금액</th><th>구분</th></tr></thead><tbody>{transferCandidates.map((candidate) => (
                  <tr key={candidate.id} onClick={() => void linkTransfer(candidate.id)}>
                    <td>{candidate.transactionDate}</td><td>{candidate.ownerName}</td><td>{candidate.accountName}</td>
                    <td>{BigInt(candidate.amount).toLocaleString("ko-KR")}원</td>
                    <td>{candidate.linkType === "SELF" ? "본인" : "회원 간"}</td>
                  </tr>
                ))}</tbody></table></div>
              : <p className={styles.transferLinkEmpty}>날짜가 3일 이내이고 금액이 같은 반대 방향 이체가 없습니다.</p>}
        </DialogContent>
        <DialogActions>
          {transferTarget?.transfer_link_id && <Button color="error" disabled={transferLoading} onClick={() => void unlinkTransfer()}>연결 해제</Button>}
          <Button disabled={transferLoading} onClick={() => { setTransferTarget(null); setTransferCandidates([]); }}>닫기</Button>
        </DialogActions>
      </Dialog>
      <AlertDialog open={!!alert} title={alert?.title ?? ""} message={alert?.message ?? ""} onClose={() => setAlert(null)} />
    </>
  );
}
