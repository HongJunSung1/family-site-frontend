import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "../../../../common/table";
import { ConfirmDialog } from "../../../../common/dialog";
import { LoadingOverlay } from "../../../../common/loading";
import { ApiError } from "../../../../api/client";
import {
  deleteAssetAccountType,
  deleteAssetInstitution,
  getAssetAccountTypes,
  getAssetInstitutions,
  reorderAssetAccountTypes,
  reorderAssetInstitutions,
  saveAssetAccountType,
  saveAssetInstitution,
  type AssetAccountType,
  type AssetInstitution,
} from "../../../../api/assetApi";
import type { AssetScreenProps } from "../types";
import styles from "../AssetManagement.module.css";

type Tab = "institution" | "type";
type InstitutionForm = {
  id?: number;
  name: string;
  isActive: boolean;
  displayOrder: number;
};
type TypeForm = InstitutionForm & {
  assetKind: "ASSET" | "LIABILITY";
  requiresInstitution: boolean;
  allowsAvailable: boolean;
};
type DeleteTarget = { id: number; name: string; tab: Tab };
const newInstitution = (): InstitutionForm => ({
  name: "",
  isActive: true,
  displayOrder: 0,
});
const newType = (): TypeForm => ({
  ...newInstitution(),
  assetKind: "ASSET",
  requiresInstitution: false,
  allowsAvailable: true,
});

export default function AssetReferenceManagement({ calendarId, calendarName, calendarControl }: AssetScreenProps) {
  const [tab, setTab] = useState<Tab>("institution");
  const [institutions, setInstitutions] = useState<AssetInstitution[]>([]);
  const [types, setTypes] = useState<AssetAccountType[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [institutionForm, setInstitutionForm] = useState<InstitutionForm | null>(null);
  const [typeForm, setTypeForm] = useState<TypeForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 금융기관과 계정 구분 목록 및 관리 권한 조회
  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const [institutionData, typeData] = await Promise.all([
        getAssetInstitutions(calendarId),
        getAssetAccountTypes(calendarId),
      ]);
      setInstitutions(institutionData.institutions);
      setTypes(typeData.accountTypes);
      setCanManage(institutionData.canManage && typeData.canManage);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "기준 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    setInstitutionForm(null);
    setTypeForm(null);
    void load();
  }, [load]);

  const closeEditor = () => (
    tab === "institution" ? setInstitutionForm(null) : setTypeForm(null)
  );
  const activeForm = tab === "institution" ? institutionForm : typeForm;

  async function move(tabName: Tab, id: number, direction: -1 | 1) {
    const rows = tabName === "institution" ? institutions : types;
    const index = rows.findIndex((row) => row.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= rows.length) return;

    const ids = rows.map((row) => row.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];

    try {
      if (tabName === "institution") await reorderAssetInstitutions(calendarId, ids);
      else await reorderAssetAccountTypes(calendarId, ids);
      await load();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "순서를 변경하지 못했습니다.");
    }
  }

  function orderColumn<T extends { id: number }>(rows: T[], tabName: Tab): DataTableColumn<T> {
    return {
      key: "order",
      header: "순서",
      width: 48,
      className: styles.orderColumn,
      render: (row) => {
        const index = rows.findIndex((item) => item.id === row.id);

        return (
          <span className={styles.orderButtons}>
            <button
              type="button"
              disabled={!canManage || index === 0}
              aria-label="위로 이동"
              onClick={(event) => {
                event.stopPropagation();
                void move(tabName, row.id, -1);
              }}
            >
              ▲
            </button>
            <button
              type="button"
              disabled={!canManage || index === rows.length - 1}
              aria-label="아래로 이동"
              onClick={(event) => {
                event.stopPropagation();
                void move(tabName, row.id, 1);
              }}
            >
              ▼
            </button>
          </span>
        );
      },
    };
  }

  const institutionColumns: DataTableColumn<AssetInstitution>[] = [
    orderColumn(institutions, "institution"),
    { key: "name", header: "금융기관명", render: (row) => row.institution_name },
    { key: "active", header: "상태", width: 100, render: (row) => row.is_active ? "사용" : "종료" },
  ];
  const typeColumns: DataTableColumn<AssetAccountType>[] = [
    orderColumn(types, "type"),
    { key: "name", header: "구분명", render: (row) => row.type_name },
    { key: "kind", header: "종류", width: 60, render: (row) => row.asset_kind === "ASSET" ? "자산" : "부채" },
    {
      key: "institution",
      header: <>금융기관<br />필수기재</>,
      width: 70,
      className: styles.mobileOptionalColumn,
      render: (row) => row.requires_institution ? "O" : "X",
    },
    { key: "available", header: "가용재산", width: 70, className: styles.mobileOptionalColumn, render: (row) => row.allows_available ? "O" : "X" },
    { key: "active", header: "상태", width: 60, render: (row) => row.is_active ? "사용" : "종료" },
  ];

  async function submit() {
    setMessage("");
    setSaving(true);

    try {
      if (tab === "institution" && institutionForm) {
        await saveAssetInstitution({
          calendarId,
          name: institutionForm.name,
          isActive: institutionForm.isActive,
          displayOrder: institutionForm.displayOrder,
        }, institutionForm.id);
        setInstitutionForm(null);
      } else if (tab === "type" && typeForm) {
        await saveAssetAccountType({
          calendarId,
          name: typeForm.name,
          isActive: typeForm.isActive,
          displayOrder: typeForm.displayOrder,
          assetKind: typeForm.assetKind,
          requiresInstitution: typeForm.requiresInstitution,
          allowsAvailable: typeForm.assetKind === "ASSET" && typeForm.allowsAvailable,
        }, typeForm.id);
        setTypeForm(null);
      }
      await load();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.tab === "institution") await deleteAssetInstitution(deleteTarget.id);
      else await deleteAssetAccountType(deleteTarget.id);
      setDeleteTarget(null);
      closeEditor();
      await load();
    } catch (error) {
      setDeleteTarget(null);
      setMessage(error instanceof ApiError ? error.message : "삭제하지 못했습니다.");
    }
  }

  return (
    <section className={styles.screen}>
      <header className={styles.screenHeader}>
        <div>
          <h1>기준 정보 관리</h1>
          <p>{calendarName}의 금융기관과 계정 구분을 관리합니다.</p>
        </div>
        {calendarControl}
      </header>

    <div className={styles.tabs} role="tablist">
      <div className={styles.tabButtons}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "institution"}
          className={tab === "institution" ? styles.tabActive : ""}
          onClick={() => {
            setTab("institution");
            setTypeForm(null);
          }}
        >
          금융기관
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "type"}
          className={tab === "type" ? styles.tabActive : ""}
          onClick={() => {
            setTab("type");
            setInstitutionForm(null);
          }}
        >
          계정 구분
        </button>
      </div>

      {canManage && (
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => tab === "institution"
            ? setInstitutionForm({ ...newInstitution(), displayOrder: institutions.length })
            : setTypeForm({ ...newType(), displayOrder: types.length })}
        >
          추가
        </button>
      )}
    </div>

    {message && (
      <p className={styles.message} role="alert">{message}</p>
    )}
    <div
      className={[styles.managementGrid, activeForm ? styles.managementGridEditing : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.tableSection}>
        {!loading && (tab === "institution" ? (
          <DataTable
            ariaLabel="금융기관 목록"
            columns={institutionColumns}
            rows={institutions}
            getRowKey={(row) => row.id}
            emptyMessage="등록된 금융기관이 없습니다."
            onRowClick={(row) => canManage && setInstitutionForm({
              id: row.id,
              name: row.institution_name,
              isActive: !!row.is_active,
              displayOrder: row.display_order,
            })}
          />
        ) : (
          <DataTable
            ariaLabel="계정 구분 목록"
            columns={typeColumns}
            rows={types}
            getRowKey={(row) => row.id}
            emptyMessage="등록된 계정 구분이 없습니다."
            onRowClick={(row) => canManage && setTypeForm({
              id: row.id,
              name: row.type_name,
              isActive: !!row.is_active,
              displayOrder: row.display_order,
              assetKind: row.asset_kind,
              requiresInstitution: !!row.requires_institution,
              allowsAvailable: !!row.allows_available,
            })}
          />
        ))}
      </div>

      {activeForm && (
        <aside
          className={styles.editorPanel}
          aria-label={activeForm.id ? "기준 정보 수정" : "기준 정보 추가"}
        >
          <div className={styles.editorHeader}>
            <h2>{activeForm.id ? "수정" : "추가"}</h2>
            <button type="button" onClick={closeEditor} aria-label="편집 닫기">×</button>
          </div>
          <div className={styles.formFields}>
            <label>
              <span>{tab === "institution" ? "금융기관명" : "구분명"}</span>
              <input
                value={activeForm.name}
                onChange={(event) => tab === "institution"
                  ? setInstitutionForm((form) => form && ({
                    ...form,
                    name: event.target.value,
                  }))
                  : setTypeForm((form) => form && ({
                    ...form,
                    name: event.target.value,
                  }))}
              />
            </label>

            {tab === "type" && typeForm && (
              <>
                <label>
                  <span>자산 종류</span>
                  <select
                    value={typeForm.assetKind}
                    onChange={(event) => setTypeForm({
                      ...typeForm,
                      assetKind: event.target.value as "ASSET" | "LIABILITY",
                      allowsAvailable: event.target.value === "ASSET"
                        && typeForm.allowsAvailable,
                    })}
                  >
                    <option value="ASSET">자산</option>
                    <option value="LIABILITY">부채</option>
                  </select>
                </label>

                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={typeForm.requiresInstitution}
                    onChange={(event) => setTypeForm({
                      ...typeForm,
                      requiresInstitution: event.target.checked,
                    })}
                  />
                  <span>금융기관 필수 여부</span>
                </label>

                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    disabled={typeForm.assetKind === "LIABILITY"}
                    checked={typeForm.assetKind === "ASSET" && typeForm.allowsAvailable}
                    onChange={(event) => setTypeForm({
                      ...typeForm,
                      allowsAvailable: event.target.checked,
                    })}
                  />
                  <span>가용재산</span>
                </label>
              </>
            )}

            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={activeForm.isActive}
                onChange={(event) => tab === "institution"
                  ? setInstitutionForm((form) => form && ({
                    ...form,
                    isActive: event.target.checked,
                  }))
                  : setTypeForm((form) => form && ({
                    ...form,
                    isActive: event.target.checked,
                  }))}
              />
              <span>계정 사용</span>
            </label>
          </div>

          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeEditor}
            >
              취소
            </button>

            {activeForm.id && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => setDeleteTarget({
                  id: activeForm.id!,
                  name: activeForm.name,
                  tab,
                })}
              >
                삭제
              </button>
            )}

            <button
              type="button"
              className={styles.primaryButton}
              disabled={saving || !activeForm.name.trim()}
              onClick={() => void submit()}
            >
              {saving ? "저장 중" : "저장"}
            </button>
          </div>
        </aside>
      )}
    </div>
    <LoadingOverlay active={loading} label="기준 정보 로딩 중" />
      <ConfirmDialog
        open={!!deleteTarget}
        title="기준 정보 삭제"
        message={`${deleteTarget?.name ?? "선택 항목"}을 삭제하시겠습니까?`}
        cancelLabel="취소"
        confirmLabel="삭제"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
