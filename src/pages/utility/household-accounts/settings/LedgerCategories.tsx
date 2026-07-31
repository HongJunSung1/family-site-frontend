import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../../api/client";
import {
  deleteLedgerCategories,
  getLedgerCategories,
  saveLedgerCategory,
  type LedgerCategory,
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
  displayOrder: number;
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
    displayOrder: category.display_order + 1,
    isNew: false,
    isDirty: false,
  };
}

function rowCode(row: CategoryRow) {
  return row.isNew ? "A" : String(row.id);
}

export default function LedgerCategories({
  calendarId,
  calendarControl,
}: LedgerScreenProps) {
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null);
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [nextTemporaryId, setNextTemporaryId] = useState(-1);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<CategoryRow[]>([]);
  const [deleteDiscardIds, setDeleteDiscardIds] = useState<Set<number>>(new Set());
  const [pendingSelection, setPendingSelection] = useState<{
    depth: 1 | 2;
    id: number;
    discardCount: number;
  } | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const load = useCallback(async (context?: {
    rootId: number | null;
    middleId: number | null;
  }) => {
    if (!calendarId) {
      setCategories([]);
      setRows([]);
      setCanManage(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getLedgerCategories(calendarId);
      setCategories(data.categories);
      setRows(data.categories.map(toRow));
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
      setSelectedRootId(validRootId);
      setSelectedMiddleId(validMiddleId);
      setCheckedIds(new Set());
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

  const roots = useMemo(
    () => rows.filter((row) => row.depth === 1 && (!activeOnly || row.isActive)),
    [activeOnly, rows],
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
  const dirtyRows = rows.filter((row) => row.isDirty);
  const invalidRows = dirtyRows.filter((row) =>
    !row.name.trim()
    || (row.depth > 1 && !row.parentId)
    || !Number.isInteger(row.displayOrder)
    || row.displayOrder < 1,
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
    if (discardCount) {
      setPendingSelection({ depth: 1, id, discardCount });
      return;
    }
    applyRootSelection(id);
  }

  function applyMiddleSelection(id: number) {
    if (selectedMiddleId !== null && selectedMiddleId !== id) {
      restoreHiddenRows((row) => row.depth === 3 && row.parentId === selectedMiddleId);
    }
    setSelectedMiddleId(id);
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
    if (discardCount) {
      setPendingSelection({ depth: 2, id, discardCount });
      return;
    }
    applyMiddleSelection(id);
  }

  function confirmSelectionChange() {
    if (!pendingSelection) return;
    if (pendingSelection.depth === 1) applyRootSelection(pendingSelection.id);
    else applyMiddleSelection(pendingSelection.id);
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
    const siblingCount = rows.filter((row) =>
      row.depth === depth && row.parentId === parentId
    ).length;
    const id = nextTemporaryId;
    setRows((current) => [...current, {
      id,
      depth,
      parentId,
      name: "",
      isActive: true,
      displayOrder: siblingCount + 1,
      isNew: true,
      isDirty: true,
    }]);
    setNextTemporaryId((value) => value - 1);
  }

  function cancelChanges() {
    setRows(categories.map(toRow));
    if (!categories.some((item) => item.id === selectedRootId && item.depth === 1)) {
      setSelectedRootId(null);
      setSelectedMiddleId(null);
    } else if (!categories.some(
      (item) => item.id === selectedMiddleId
        && item.depth === 2
        && item.parent_id === selectedRootId,
    )) {
      setSelectedMiddleId(null);
    }
    setCheckedIds(new Set());
  }

  async function saveAll() {
    if (!dirtyRows.length || invalidRows.length) return;
    setSaving(true);
    const idMap = new Map<number, number>();
    try {
      for (const row of [...dirtyRows].sort((a, b) => a.depth - b.depth || a.displayOrder - b.displayOrder)) {
        const parentId = row.parentId !== null
          ? idMap.get(row.parentId) ?? row.parentId
          : null;
        const result = await saveLedgerCategory({
          calendarId,
          parentId,
          name: row.name,
          isActive: row.isActive,
          displayOrder: row.displayOrder - 1,
        }, row.isNew ? undefined : row.id);
        if (row.isNew && result.categoryId) idMap.set(row.id, result.categoryId);
      }
      const nextRootId = selectedRootId === null
        ? null
        : idMap.get(selectedRootId) ?? selectedRootId;
      const nextMiddleId = selectedMiddleId === null
        ? null
        : idMap.get(selectedMiddleId) ?? selectedMiddleId;
      await load({ rootId: nextRootId, middleId: nextMiddleId });
    } catch (error) {
      await load({ rootId: selectedRootId, middleId: selectedMiddleId });
      setAlertTitle("분류 저장 실패");
      setAlertMessage(error instanceof ApiError ? error.message : "변경사항을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTargets.length) return;
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
      }
      if (selectedRootId !== null && removedIds.has(selectedRootId)) {
        setSelectedRootId(null);
        setSelectedMiddleId(null);
      }
      setDeleteTargets([]);
      setDeleteDiscardIds(new Set());
      setCheckedIds(new Set());
    } catch (error) {
      if (deletedIds.size) {
        setRows((current) => current.filter((row) => !deletedIds.has(row.id)));
        setCategories((current) => current.filter((row) => !deletedIds.has(row.id)));
      }
      setDeleteTargets([]);
      setDeleteDiscardIds(new Set());
      setAlertTitle("분류 삭제 불가");
      setAlertMessage(error instanceof ApiError ? error.message : "분류를 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function requestDelete() {
    const targets = rows.filter((row) => checkedIds.has(row.id));
    if (!targets.length) return;
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
                <th className={styles.sheetCodeColumn}>코드</th>
                <th className={styles.sheetOrderColumn}>순서</th>
                <th>{DEPTH_LABEL[depth]}</th>
                <th className={styles.sheetStatusColumn}>사용</th>
              </tr>
            </thead>
            <tbody>
              {sheetRows
                .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
                .map((row) => (
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
                    <td className={styles.sheetCodeCell}>{rowCode(row)}</td>
                    <td>
                      <input
                        aria-label={`${row.name || "새 분류"} 순서`}
                        type="number"
                        min={1}
                        value={row.displayOrder}
                        disabled={!canManage}
                        onChange={(event) => updateRow(row.id, {
                          displayOrder: Number(event.target.value),
                        })}
                      />
                    </td>
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
                    colSpan={canManage ? 5 : 4}
                  >
                    {depth > 1 && !parent
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
    <section className={styles.screen}>
      <header className={styles.screenHeader}>
        <h1>분류 관리</h1>
        <div className={styles.screenHeaderActions}>
          {calendarControl}
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
                disabled={saving || checkedIds.size === 0}
                onClick={requestDelete}
              >
                삭제
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={saving || dirtyRows.length === 0}
                onClick={cancelChanges}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={saving || dirtyRows.length === 0 || invalidRows.length > 0}
                onClick={() => void saveAll()}
              >
                {saving ? "저장 중" : "저장"}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.categoryTripleSheet}>
        {renderSheet(1, roots, selectedRootId, selectRoot)}
        {renderSheet(2, middles, selectedMiddleId, selectMiddle)}
        {renderSheet(3, leaves, null)}
      </div>

      <LoadingOverlay active={loading} label="분류 불러오는 중" />
      <ConfirmDialog
        open={deleteTargets.length > 0}
        title="선택 분류 삭제"
        message={
          deleteDiscardIds.size > 0
            ? `선택한 분류를 삭제하면 그 아래 저장하지 않은 데이터 ${deleteDiscardIds.size}건도 함께 삭제됩니다. 계속하시겠습니까?`
            : `선택한 분류 ${deleteTargets.length}건을 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.`
        }
        cancelLabel="취소"
        confirmLabel="삭제"
        onClose={() => {
          setDeleteTargets([]);
          setDeleteDiscardIds(new Set());
        }}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmDialog
        open={!!pendingSelection}
        title="조회 분류 변경"
        message={`다른 분류를 조회하면 작성하고 저장하지 않은 데이터 ${pendingSelection?.discardCount ?? 0}건이 삭제됩니다. 계속하시겠습니까?`}
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
