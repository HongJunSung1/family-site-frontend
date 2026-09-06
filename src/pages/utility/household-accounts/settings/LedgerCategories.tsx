import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../../api/client";
import {
  deleteLedgerCategories,
  getLedgerCategories,
  getLedgerClassificationRules,
  saveLedgerCategory,
  syncLedgerCategoryClassificationRules,
  type LedgerCategory,
  type LedgerClassificationRule,
} from "../../../../api/ledgerApi";
import { AlertDialog, ConfirmDialog } from "../../../../common/dialog";
import { LoadingOverlay } from "../../../../common/loading";
import type { LedgerScreenProps } from "../types";
import styles from "../HouseholdAccounts.module.css";

type Depth = 1 | 2 | 3;
type CategoryRow = {
  id: number;
  depth: Depth;
  parentId: number | null;
  name: string;
  isActive: boolean;
  isNew: boolean;
  isDirty: boolean;
};

const DEPTH_LABEL: Record<Depth, string> = {
  1: "대분류",
  2: "중분류",
  3: "소분류",
};

function toRow(category: LedgerCategory): CategoryRow {
  return {
    id: category.id,
    depth: category.depth,
    parentId: category.parent_id,
    name: category.category_name,
    isActive: !!category.is_active,
    isNew: false,
    isDirty: false,
  };
}

function sortRows(rows: CategoryRow[]) {
  return [...rows].sort((left, right) => (
    left.depth - right.depth
    || (left.parentId ?? 0) - (right.parentId ?? 0)
    || left.name.localeCompare(right.name, "ko")
    || left.id - right.id
  ));
}

export default function LedgerCategories({
  calendarId,
  calendarControl,
  embedded = false,
  onCategoriesChanged,
}: LedgerScreenProps & { embedded?: boolean; onCategoriesChanged?: () => void | Promise<void> }) {
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  const [classificationRules, setClassificationRules] = useState<LedgerClassificationRule[]>([]);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null);
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null);
  const [selectedLeafId, setSelectedLeafId] = useState<number | null>(null);
  const [ruleValues, setRuleValues] = useState<string[]>([]);
  const [ruleDirty, setRuleDirty] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nextTemporaryId, setNextTemporaryId] = useState(-1);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<CategoryRow[]>([]);
  const [deleteDiscardIds, setDeleteDiscardIds] = useState<Set<number>>(new Set());
  const [deleteRuleIndexes, setDeleteRuleIndexes] = useState<Set<number>>(new Set());
  const [pendingSelection, setPendingSelection] = useState<{
    depth: 1 | 2 | 3;
    id: number;
    discardCount: number;
    discardsRule: boolean;
  } | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [checkedRuleIndexes, setCheckedRuleIndexes] = useState<Set<number>>(new Set());
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const load = useCallback(async (context?: {
    rootId: number | null;
    middleId: number | null;
    leafId?: number | null;
  }) => {
    if (!calendarId) {
      setCategories([]);
      setClassificationRules([]);
      setRows([]);
      setCanManage(false);
      return;
    }
    setLoading(true);
    try {
      const [data, ruleData] = await Promise.all([
        getLedgerCategories(calendarId), getLedgerClassificationRules(calendarId),
      ]);
      setCategories(data.categories);
      setClassificationRules(ruleData.rules);
      setRows(sortRows(data.categories.map(toRow)));
      setCanManage(data.canManage);
      const rootId = context?.rootId ?? null;
      const validRootId = data.categories.some(
        (item) => item.id === rootId && item.depth === 1,
      ) ? rootId : null;
      const middleId = context?.middleId ?? null;
      const validMiddleId = data.categories.some(
        (item) => item.id === middleId
          && item.depth === 2
          && item.parent_id === validRootId,
      ) ? middleId : null;
      const leafId = context?.leafId ?? null;
      const validLeafId = data.categories.some(
        (item) => item.id === leafId && item.depth === 3 && item.parent_id === validMiddleId,
      ) ? leafId : null;
      setSelectedRootId(validRootId);
      setSelectedMiddleId(validMiddleId);
      setSelectedLeafId(validLeafId);
      setRuleValues(validLeafId === null ? [] : ruleData.rules
        .filter((rule) => rule.category_id === validLeafId && rule.is_active)
        .map((rule) => rule.match_value));
      setRuleDirty(false);
      setCheckedIds(new Set());
      setCheckedRuleIndexes(new Set());
    } catch (error) {
      setAlertTitle("분류 조회 실패");
      setAlertMessage(error instanceof ApiError ? error.message : "분류를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    setNextTemporaryId(-1);
    void load();
  }, [load]);

  const matchingRootIds = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ko");
    if (!query) return null;
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const result = new Set<number>();
    const addRoot = (row: CategoryRow | undefined) => {
      if (!row) return;
      if (row.depth === 1) { result.add(row.id); return; }
      const parent = row.parentId === null ? undefined : rowById.get(row.parentId);
      if (row.depth === 2) { if (parent?.depth === 1) result.add(parent.id); return; }
      const root = parent?.parentId === null || parent?.parentId === undefined
        ? undefined : rowById.get(parent.parentId);
      if (root?.depth === 1) result.add(root.id);
    };
    rows.forEach((row) => {
      if (row.name.toLocaleLowerCase("ko").includes(query)) addRoot(row);
    });
    classificationRules.forEach((rule) => {
      if (rule.category_id !== selectedLeafId
        && rule.is_active
        && rule.match_value.toLocaleLowerCase("ko").includes(query)) {
        addRoot(rowById.get(rule.category_id));
      }
    });
    if (selectedLeafId !== null && ruleValues.some((value) => value.toLocaleLowerCase("ko").includes(query))) {
      addRoot(rowById.get(selectedLeafId));
    }
    return result;
  }, [classificationRules, rows, ruleValues, searchQuery, selectedLeafId]);
  const roots = useMemo(
    () => rows.filter((row) => row.depth === 1
      && (!activeOnly || row.isActive)
      && (matchingRootIds === null || matchingRootIds.has(row.id))),
    [activeOnly, matchingRootIds, rows],
  );
  const middles = useMemo(
    () => rows.filter((row) =>
      row.depth === 2
      && row.parentId === selectedRootId
      && (!activeOnly || row.isActive)
    ),
    [activeOnly, rows, selectedRootId],
  );
  const leaves = useMemo(
    () => rows.filter((row) =>
      row.depth === 3
      && row.parentId === selectedMiddleId
      && (!activeOnly || row.isActive)
    ),
    [activeOnly, rows, selectedMiddleId],
  );
  useEffect(() => {
    if (matchingRootIds === null) return;
    setCheckedIds((current) => {
      const next = new Set([...current].filter((checkedId) => {
        const row = rows.find((item) => item.id === checkedId);
        return row?.depth !== 1 || matchingRootIds.has(checkedId);
      }));
      return next.size === current.size ? current : next;
    });
  }, [matchingRootIds, rows]);
  const dirtyRows = rows.filter((row) => row.isDirty);
  const hasRuleChanges = ruleDirty;
  const invalidRows = dirtyRows.filter((row) =>
    !row.name.trim()
    || (row.depth > 1 && !row.parentId)
  );

  function updateRow(id: number, patch: Partial<CategoryRow>) {
    setRows((current) => current.map((row) =>
      row.id === id ? { ...row, ...patch, isDirty: true } : row
    ));
  }

  function rootHiddenPredicate(row: CategoryRow) {
    if (selectedRootId === null) return false;
    const previousMiddleIds = new Set(
      rows
        .filter((item) => item.depth === 2 && item.parentId === selectedRootId)
        .map((item) => item.id),
    );
    return (row.depth === 2 && row.parentId === selectedRootId)
      || (row.depth === 3 && row.parentId !== null && previousMiddleIds.has(row.parentId));
  }

  function applyRootSelection(id: number) {
    if (selectedRootId !== null && selectedRootId !== id) {
      restoreHiddenRows(rootHiddenPredicate);
    }
    setSelectedRootId(id);
    setSelectedMiddleId(null);
    setSelectedLeafId(null);
    setRuleValues([]);
    setRuleDirty(false);
    setCheckedRuleIndexes(new Set());
    const visibleIds = new Set(
      rows
        .filter((row) =>
          row.depth === 1 || (row.depth === 2 && row.parentId === id)
        )
        .map((row) => row.id),
    );
    setCheckedIds((current) => new Set([...current].filter((checkedId) => visibleIds.has(checkedId))));
  }

  function selectRoot(id: number) {
    if (selectedRootId === id) return;
    const discardCount = rows.filter((row) => rootHiddenPredicate(row) && row.isDirty).length;
    if (discardCount || hasRuleChanges) {
      setPendingSelection({ depth: 1, id, discardCount, discardsRule: hasRuleChanges });
      return;
    }
    applyRootSelection(id);
  }

  function applyMiddleSelection(id: number) {
    if (selectedMiddleId !== null && selectedMiddleId !== id) {
      restoreHiddenRows((row) => row.depth === 3 && row.parentId === selectedMiddleId);
    }
    setSelectedMiddleId(id);
    setSelectedLeafId(null);
    setRuleValues([]);
    setRuleDirty(false);
    setCheckedRuleIndexes(new Set());
    const visibleIds = new Set(
      rows
        .filter((row) =>
          row.depth === 1
          || (row.depth === 2 && row.parentId === selectedRootId)
          || (row.depth === 3 && row.parentId === id)
        )
        .map((row) => row.id),
    );
    setCheckedIds((current) => new Set([...current].filter((checkedId) => visibleIds.has(checkedId))));
  }

  function selectMiddle(id: number) {
    if (selectedMiddleId === id) return;
    const discardCount = rows.filter(
      (row) => row.depth === 3 && row.parentId === selectedMiddleId && row.isDirty,
    ).length;
    if (discardCount || hasRuleChanges) {
      setPendingSelection({ depth: 2, id, discardCount, discardsRule: hasRuleChanges });
      return;
    }
    applyMiddleSelection(id);
  }

  function applyLeafSelection(id: number) {
    setSelectedLeafId(id);
    setRuleValues(classificationRules
      .filter((rule) => rule.category_id === id && rule.is_active)
      .map((rule) => rule.match_value));
    setRuleDirty(false);
    setCheckedRuleIndexes(new Set());
  }

  function selectLeaf(id: number) {
    if (selectedLeafId === id) return;
    if (hasRuleChanges) {
      setPendingSelection({ depth: 3, id, discardCount: 0, discardsRule: true });
      return;
    }
    applyLeafSelection(id);
  }

  function confirmSelectionChange() {
    if (!pendingSelection) return;
    if (pendingSelection.depth === 1) applyRootSelection(pendingSelection.id);
    else if (pendingSelection.depth === 2) applyMiddleSelection(pendingSelection.id);
    else applyLeafSelection(pendingSelection.id);
    setPendingSelection(null);
  }

  function restoreHiddenRows(predicate: (row: CategoryRow) => boolean) {
    const savedById = new Map(categories.map((category) => [category.id, category]));
    setRows((current) => current.flatMap((row) => {
      if (!predicate(row)) return [row];
      const saved = savedById.get(row.id);
      return saved ? [toRow(saved)] : [];
    }));
  }

  function addRow(depth: Depth) {
    const parentId = depth === 1
      ? null
      : depth === 2
        ? selectedRootId
        : selectedMiddleId;
    if (depth > 1 && !parentId) {
      setAlertTitle("행 추가 불가");
      setAlertMessage(`${depth === 2 ? "대분류" : "중분류"} 행을 먼저 선택해주세요.`);
      return;
    }
    const id = nextTemporaryId;
    setRows((current) => [...current, {
      id,
      depth,
      parentId,
      name: "",
      isActive: true,
      isNew: true,
      isDirty: true,
    }]);
    setNextTemporaryId((value) => value - 1);
  }

  function cancelChanges() {
    setRows(sortRows(categories.map(toRow)));
    const validLeafId = categories.some(
      (item) => item.id === selectedLeafId && item.depth === 3 && item.parent_id === selectedMiddleId,
    ) ? selectedLeafId : null;
    if (!categories.some((item) => item.id === selectedRootId && item.depth === 1)) {
      setSelectedRootId(null);
      setSelectedMiddleId(null);
      setSelectedLeafId(null);
    } else if (!categories.some(
      (item) => item.id === selectedMiddleId
        && item.depth === 2
        && item.parent_id === selectedRootId,
    )) {
      setSelectedMiddleId(null);
      setSelectedLeafId(null);
    }
    setSelectedLeafId(validLeafId);
    setRuleValues(validLeafId === null ? [] : classificationRules
      .filter((rule) => rule.category_id === validLeafId && rule.is_active)
      .map((rule) => rule.match_value));
    setRuleDirty(false);
    setCheckedIds(new Set());
    setCheckedRuleIndexes(new Set());
  }

  function addRuleRow() {
    if (selectedLeafId === null) return;
    setRuleValues((current) => [...current, ""]);
    setRuleDirty(true);
  }

  function updateRuleValue(index: number, value: string) {
    setRuleValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
    setRuleDirty(true);
  }

  async function saveAll() {
    if ((!dirtyRows.length && !hasRuleChanges) || invalidRows.length) return;
    const nextRuleValues = ruleValues.map((value) => value.trim()).filter(Boolean);
    const normalizedRuleValues = nextRuleValues.map((value) => value.toLocaleLowerCase("ko"));
    if (new Set(normalizedRuleValues).size !== normalizedRuleValues.length) {
      setAlertTitle("자동분류 문구 중복");
      setAlertMessage("이미 입력한 자동분류 문구입니다.");
      return;
    }
    setSaving(true);
    const idMap = new Map<number, number>();
    try {
      for (const row of [...dirtyRows].sort((a, b) => (
        a.depth - b.depth || a.name.localeCompare(b.name, "ko")
      ))) {
        const parentId = row.parentId !== null
          ? idMap.get(row.parentId) ?? row.parentId
          : null;
        const result = await saveLedgerCategory({
          calendarId,
          parentId,
          name: row.name,
          isActive: row.isActive,
        }, row.isNew ? undefined : row.id);
        if (row.isNew && result.categoryId) idMap.set(row.id, result.categoryId);
      }
      const nextRootId = selectedRootId === null
        ? null
        : idMap.get(selectedRootId) ?? selectedRootId;
      const nextMiddleId = selectedMiddleId === null
        ? null
        : idMap.get(selectedMiddleId) ?? selectedMiddleId;
      const nextLeafId = selectedLeafId === null
        ? null
        : idMap.get(selectedLeafId) ?? selectedLeafId;
      if (hasRuleChanges && nextLeafId !== null) {
        await syncLedgerCategoryClassificationRules(calendarId, nextLeafId, nextRuleValues);
      }
      await load({ rootId: nextRootId, middleId: nextMiddleId, leafId: nextLeafId });
      await onCategoriesChanged?.();
    } catch (error) {
      await load({ rootId: selectedRootId, middleId: selectedMiddleId, leafId: selectedLeafId });
      setAlertTitle("분류 저장 실패");
      setAlertMessage(error instanceof ApiError ? error.message : "변경사항을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTargets.length && !deleteRuleIndexes.size) return;
    setSaving(true);
    const deletedIds = new Set<number>();
    try {
      const persistedTargets = deleteTargets
        .filter((row) => !row.isNew)
        .sort((a, b) => b.depth - a.depth);
      if (persistedTargets.length) {
        await deleteLedgerCategories(persistedTargets.map((row) => row.id));
        persistedTargets.forEach((row) => deletedIds.add(row.id));
      }
      const removedIds = new Set([...deletedIds, ...deleteDiscardIds]);
      deleteTargets.filter((row) => row.isNew).forEach((row) => removedIds.add(row.id));
      setRows((current) => current.filter((row) => !removedIds.has(row.id)));
      setCategories((current) => current.filter((row) => !deletedIds.has(row.id)));
      if (selectedMiddleId !== null && removedIds.has(selectedMiddleId)) {
        setSelectedMiddleId(null);
        setSelectedLeafId(null);
        setRuleValues([]);
        setRuleDirty(false);
      }
      if (selectedRootId !== null && removedIds.has(selectedRootId)) {
        setSelectedRootId(null);
        setSelectedMiddleId(null);
        setSelectedLeafId(null);
        setRuleValues([]);
        setRuleDirty(false);
      }
      if (selectedLeafId !== null && removedIds.has(selectedLeafId)) {
        setSelectedLeafId(null);
        setRuleValues([]);
        setRuleDirty(false);
      }
      if (deleteRuleIndexes.size && (selectedLeafId === null || !removedIds.has(selectedLeafId))) {
        setRuleValues((current) => current.filter((_, index) => !deleteRuleIndexes.has(index)));
        setRuleDirty(true);
      }
      setDeleteTargets([]);
      setDeleteDiscardIds(new Set());
      setDeleteRuleIndexes(new Set());
      setCheckedIds(new Set());
      setCheckedRuleIndexes(new Set());
      if (persistedTargets.length) await onCategoriesChanged?.();
    } catch (error) {
      if (deletedIds.size) {
        setRows((current) => current.filter((row) => !deletedIds.has(row.id)));
        setCategories((current) => current.filter((row) => !deletedIds.has(row.id)));
      }
      setDeleteTargets([]);
      setDeleteDiscardIds(new Set());
      setDeleteRuleIndexes(new Set());
      setAlertTitle("분류 삭제 불가");
      setAlertMessage(error instanceof ApiError ? error.message : "분류를 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function requestDelete() {
    const targets = rows.filter((row) => checkedIds.has(row.id));
    if (!targets.length && !checkedRuleIndexes.size) return;
    const targetIds = new Set(targets.map((row) => row.id));
    const affectedIds = new Set(targetIds);
    let added = true;
    while (added) {
      added = false;
      rows.forEach((row) => {
        if (row.parentId !== null && affectedIds.has(row.parentId) && !affectedIds.has(row.id)) {
          affectedIds.add(row.id);
          added = true;
        }
      });
    }
    setDeleteDiscardIds(new Set(
      rows
        .filter((row) => row.isNew && affectedIds.has(row.id))
        .map((row) => row.id),
    ));
    setDeleteTargets(targets);
    setDeleteRuleIndexes(new Set(checkedRuleIndexes));
  }

  function toggleChecked(id: number, checked: boolean) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function renderSheet(
    depth: Depth,
    sheetRows: CategoryRow[],
    selectedId: number | null,
    onSelect?: (id: number) => void,
  ) {
    const parent = depth === 2
      ? rows.find((row) => row.id === selectedRootId)
      : depth === 3
        ? rows.find((row) => row.id === selectedMiddleId)
        : null;
    return (
      <section className={styles.categorySheetPanel} aria-label={`${DEPTH_LABEL[depth]} 시트`}>
        <header className={styles.categorySheetHeader}>
          <h2>{DEPTH_LABEL[depth]}</h2>
          {canManage && calendarId > 0 && (
            <button
              type="button"
              className={styles.sheetHeaderAddButton}
              onClick={() => addRow(depth)}
            >
              ＋ 행 추가
            </button>
          )}
        </header>
        <div className={styles.categorySheet}>
          <table aria-label={`${depth}단계 분류 편집 시트`}>
            <thead>
              <tr>
                {canManage && <th className={styles.sheetCheckColumn}>선택</th>}
                <th>{DEPTH_LABEL[depth]}</th>
                <th className={styles.sheetStatusColumn}>사용</th>
              </tr>
            </thead>
            <tbody>
              {sheetRows.map((row) => (
                  <tr
                    key={row.id}
                    className={[
                      row.isDirty ? styles.sheetDirtyRow : "",
                      row.id === selectedId ? styles.sheetSelectedRow : "",
                    ].filter(Boolean).join(" ")}
                    onDoubleClick={() => onSelect?.(row.id)}
                    onClick={() => {
                      if (
                        typeof window.matchMedia === "function"
                        && window.matchMedia("(max-width: 768px)").matches
                      ) {
                        onSelect?.(row.id);
                      }
                    }}
                  >
                    {canManage && (
                      <td className={styles.sheetCheckboxCell}>
                        <input
                          aria-label={`${row.name || "새 분류"} 삭제 선택`}
                          type="checkbox"
                          checked={checkedIds.has(row.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => toggleChecked(row.id, event.target.checked)}
                        />
                      </td>
                    )}
                    <td>
                      <input
                        aria-label={`${DEPTH_LABEL[depth]}명`}
                        maxLength={40}
                        value={row.name}
                        disabled={!canManage}
                        placeholder="분류명 입력"
                        onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      />
                    </td>
                    <td className={styles.sheetCheckboxCell}>
                      <input
                        aria-label={`${row.name || "새 분류"} 사용 여부`}
                        type="checkbox"
                        checked={row.isActive}
                        disabled={!canManage}
                        onChange={(event) => updateRow(row.id, { isActive: event.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              {!sheetRows.length && (
                <tr>
                  <td
                    className={styles.sheetEmptyCell}
                    colSpan={canManage ? 3 : 2}
                  >
                    {depth === 1 && searchQuery.trim()
                      ? "검색 결과가 없습니다."
                      : depth > 1 && !parent
                      ? `상위 ${depth === 2 ? "대분류" : "중분류"} 행을 선택해주세요.`
                      : `등록된 ${DEPTH_LABEL[depth]}가 없습니다.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.screen} ${embedded ? styles.embeddedCategoryScreen : ""}`}>
      {!embedded && <header className={styles.screenHeader}>
        <h1>분류 관리</h1>
        <div className={styles.screenHeaderActions}>
          {calendarControl}
        </div>
      </header>}

      <div className={styles.categoryManagementToolbar}>
        <div className={styles.transactionSheetSearch}>
          <input
            type="search"
            aria-label="분류 검색"
            placeholder="분류 검색"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <span aria-hidden="true" />
        </div>
        <div className={styles.categoryManagementActions}>
          <label className={styles.activeOnlyFilter}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(event) => setActiveOnly(event.target.checked)}
            />
            <span>사용중인 것만 보기</span>
          </label>
          {canManage && (
            <div className={styles.categorySaveActions}>
              <button
                type="button"
                className={styles.deleteButton}
                disabled={saving || (checkedIds.size === 0 && checkedRuleIndexes.size === 0)}
                onClick={requestDelete}
              >
                삭제
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={saving || (dirtyRows.length === 0 && !hasRuleChanges)}
                onClick={cancelChanges}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={saving || (dirtyRows.length === 0 && !hasRuleChanges) || invalidRows.length > 0}
                onClick={() => void saveAll()}
              >
                {saving ? "저장 중" : "저장"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.categoryTripleSheet}>
        {renderSheet(1, roots, selectedRootId, selectRoot)}
        {renderSheet(2, middles, selectedMiddleId, selectMiddle)}
        {renderSheet(3, leaves, selectedLeafId, selectLeaf)}
        <section className={styles.categorySheetPanel} aria-label="자동분류 문구 시트">
          <header className={styles.categorySheetHeader}>
            <h2>자동분류 문구</h2>
            {canManage && selectedLeafId !== null && <button
              type="button"
              className={styles.sheetHeaderAddButton}
              onClick={addRuleRow}
            >＋ 행 추가</button>}
          </header>
          <div className={styles.categorySheet}>
            <table aria-label="자동분류 문구 편집 시트">
              <thead><tr>{canManage && <th className={styles.sheetCheckColumn}>선택</th>}<th>문구</th></tr></thead>
              <tbody>
                {selectedLeafId !== null && ruleValues.map((value, index) => <tr key={index} className={ruleDirty ? styles.sheetDirtyRow : ""}>
                  {canManage && <td className={styles.sheetCheckboxCell}><input
                    type="checkbox"
                    aria-label={`${value || "새 자동분류 문구"} 삭제 선택`}
                    checked={checkedRuleIndexes.has(index)}
                    onChange={(event) => setCheckedRuleIndexes((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(index); else next.delete(index);
                      return next;
                    })}
                  /></td>}
                  <td><input
                    aria-label="자동분류 문구 입력"
                    maxLength={200}
                    disabled={!canManage}
                    value={value}
                    placeholder="문구 입력"
                    onChange={(event) => updateRuleValue(index, event.target.value)}
                  /></td>
                </tr>)}
                {(!ruleValues.length || selectedLeafId === null) && <tr><td className={styles.sheetEmptyCell} colSpan={canManage ? 2 : 1}>
                  {selectedLeafId === null ? "소분류를 선택해주세요." : "등록된 자동분류 문구가 없습니다."}
                </td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <LoadingOverlay active={loading} label="분류 불러오는 중" />
      <ConfirmDialog
        open={deleteTargets.length > 0 || deleteRuleIndexes.size > 0}
        title="선택 분류 삭제"
        message={
          deleteTargets.length === 0
            ? `선택한 자동분류 문구 ${deleteRuleIndexes.size}건을 삭제하시겠습니까?`
            : deleteDiscardIds.size > 0
            ? `선택한 분류를 삭제하면 그 아래 저장하지 않은 데이터 ${deleteDiscardIds.size}건도 함께 삭제됩니다. 계속하시겠습니까?`
            : `선택한 분류 ${deleteTargets.length}건${deleteRuleIndexes.size ? `과 자동분류 문구 ${deleteRuleIndexes.size}건` : ""}을 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.`
        }
        cancelLabel="취소"
        confirmLabel="삭제"
        onClose={() => {
          setDeleteTargets([]);
          setDeleteDiscardIds(new Set());
          setDeleteRuleIndexes(new Set());
        }}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmDialog
        open={!!pendingSelection}
        title="조회 분류 변경"
        message={pendingSelection?.discardsRule
          ? pendingSelection.discardCount > 0
            ? `다른 분류를 조회하면 작성하고 저장하지 않은 분류 데이터 ${pendingSelection.discardCount}건과 자동분류 문구가 삭제됩니다. 계속하시겠습니까?`
            : "다른 소분류를 조회하면 작성하고 저장하지 않은 자동분류 문구가 삭제됩니다. 계속하시겠습니까?"
          : `다른 분류를 조회하면 작성하고 저장하지 않은 데이터 ${pendingSelection?.discardCount ?? 0}건이 삭제됩니다. 계속하시겠습니까?`}
        cancelLabel="취소"
        confirmLabel="계속"
        onClose={() => setPendingSelection(null)}
        onConfirm={confirmSelectionChange}
      />
      <AlertDialog
        open={!!alertMessage}
        title={alertTitle}
        message={alertMessage}
        onClose={() => {
          setAlertTitle("");
          setAlertMessage("");
        }}
      />
    </section>
  );
}
