import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "../../../../common/table";
import { ConfirmDialog } from "../../../../common/dialog";
import { LoadingOverlay } from "../../../../common/loading";
import { ApiError } from "../../../../api/client";
import {
  deleteAssetAccount,
  getAssetAccounts,
  getAssetAccountTypes,
  getAssetInstitutions,
  reorderAssetAccounts,
  saveAssetAccount,
  type AssetAccount,
  type AssetAccountType,
  type AssetInstitution,
  type AssetMember,
} from "../../../../api/assetApi";
import type { AssetScreenProps } from "../types";
import styles from "../AssetManagement.module.css";

type Form = {
  id?: number;
  ownerUserId: number;
  institutionId: number | null;
  accountTypeId: number;
  accountName: string;
  isActive: boolean;
  displayOrder: number;
  memo: string;
};

export default function AssetAccountManagement({ calendarId, calendarName, calendarControl }: AssetScreenProps) {
  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [members, setMembers] = useState<AssetMember[]>([]);
  const [institutions, setInstitutions] = useState<AssetInstitution[]>([]);
  const [types, setTypes] = useState<AssetAccountType[]>([]);
  const [currentUserId, setCurrentUserId] = useState(0);
  const [role, setRole] = useState<AssetMember["role"]>("viewer");
  const [ownerFilter, setOwnerFilter] = useState<"all" | number>("all");
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  // 계정 목록과 편집에 필요한 기준 정보·권한을 함께 조회
  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const [accountData, institutionData, typeData] = await Promise.all([
        getAssetAccounts(calendarId),
        getAssetInstitutions(calendarId),
        getAssetAccountTypes(calendarId),
      ]);

      setAccounts(accountData.accounts);
      setMembers(accountData.members);
      setCurrentUserId(accountData.currentUserId);
      setRole(accountData.role);
      setInstitutions(institutionData.institutions);
      setTypes(typeData.accountTypes);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "자산 계정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    setForm(null);
    setOwnerFilter("all");
    void load();
  }, [load]);

  const visibleAccounts = useMemo(() => (
    ownerFilter === "all"
      ? accounts
      : accounts.filter((account) => account.owner_user_id === ownerFilter)
  ), [accounts, ownerFilter]);

  async function move(id: number, direction: -1 | 1) {
    const index = visibleAccounts.findIndex((row) => row.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= visibleAccounts.length) return;

    const ids = accounts.map((row) => row.id);
    const currentPosition = ids.indexOf(visibleAccounts[index].id);
    const nextPosition = ids.indexOf(visibleAccounts[next].id);
    [ids[currentPosition], ids[nextPosition]] = [ids[nextPosition], ids[currentPosition]];

    try {
      await reorderAssetAccounts(calendarId, ids);
      await load();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "순서를 변경하지 못했습니다.");
    }
  }

  const columns: DataTableColumn<AssetAccount>[] = [
    {
      key: "order",
      header: "순서",
      width: 48,
      className: styles.orderColumn,
      render: (row) => {
        const index = visibleAccounts.findIndex((item) => item.id === row.id);

        return (
          <span className={styles.orderButtons}>
            <button
              type="button"
              disabled={role !== "owner" || index === 0}
              aria-label="위로 이동"
              onClick={(event) => {
                event.stopPropagation();
                void move(row.id, -1);
              }}
            >
              ▲
            </button>
            <button
              type="button"
              disabled={role !== "owner" || index === visibleAccounts.length - 1}
              aria-label="아래로 이동"
              onClick={(event) => {
                event.stopPropagation();
                void move(row.id, 1);
              }}
            >
              ▼
            </button>
          </span>
        );
      },
    },
    { key: "owner", header: "소유자", width: 120, className: styles.mobileOptionalColumn, render: (row) => row.owner_name || "이름 없음" },
    { key: "institution", header: "금융기관", width: 150, className: styles.mobileOptionalColumn, render: (row) => row.institution_name || "금융기관 없음" },
    { key: "name", header: "계정명", render: (row) => row.account_name },
    { key: "type", header: "구분", width: 130, render: (row) => row.type_name },
    {
      key: "available",
      header: "가용",
      width: 75,
      className: styles.mobileOptionalColumn,
      render: (row) => row.asset_kind === "LIABILITY" ? "-" : row.is_available ? "예" : "아니오",
    },
    { key: "active", header: "상태", width: 80, render: (row) => row.is_active ? "사용" : "미사용" },
  ];

  const selectedType = types.find((item) => item.id === form?.accountTypeId);
  const canCreate = role === "owner" || role === "editor";

  function startNew() {
    const firstType = types.find((item) => item.is_active);
    setForm({
      ownerUserId: currentUserId,
      institutionId: null,
      accountTypeId: firstType?.id ?? 0,
      accountName: "",
      isActive: true,
      displayOrder: accounts.length,
      memo: "",
    });
  }

  function startEdit(row: AssetAccount) {
    if (role === "viewer" || (role === "editor" && row.owner_user_id !== currentUserId)) return;

    setForm({
      id: row.id,
      ownerUserId: row.owner_user_id,
      institutionId: row.institution_id,
      accountTypeId: row.account_type_id,
      accountName: row.account_name,
      isActive: !!row.is_active,
      displayOrder: row.display_order,
      memo: row.memo,
    });
  }

  async function submit() {
    if (!form) return;

    setSaving(true);
    setMessage("");

    try {
      await saveAssetAccount({
        calendarId,
        ownerUserId: form.ownerUserId,
        institutionId: form.institutionId,
        accountTypeId: form.accountTypeId,
        accountName: form.accountName,
        isActive: form.isActive,
        displayOrder: form.displayOrder,
        memo: form.memo,
      }, form.id);
      setForm(null);
      await load();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "계정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setMessage("");

    try {
      const result = await deleteAssetAccount(deleteTarget.id);
      setDeleteTarget(null);
      setForm(null);
      await load();
      setMessage(result.deletionMode === "deactivated"
        ? "월별 잔액이 있어 과거 기록을 보존하고 사용 종료 처리했습니다."
        : "계정을 삭제했습니다.");
    } catch (error) {
      setDeleteTarget(null);
      setMessage(error instanceof ApiError ? error.message : "계정을 삭제하지 못했습니다.");
    } finally { setSaving(false); }
  }

  return (
    <section className={styles.screen}>
      <header className={styles.screenHeader}>
        <div>
          <h1>자산 계정 관리</h1>
          <p>{calendarName}의 자산과 부채 계정을 관리합니다.</p>
        </div>

        <div className={styles.screenHeaderActions}>
          {calendarControl}
          <label className={styles.memberPicker}>
            소유자
            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(
                event.target.value === "all" ? "all" : Number(event.target.value),
              )}
            >
              <option value="all">전체</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          {canCreate && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={startNew}
              disabled={!types.some((item) => item.is_active)}
            >
              계정 추가
            </button>
          )}
        </div>
      </header>

      {message && (
        <p className={styles.message} role="alert">{message}</p>
      )}

      <div
        className={[styles.managementGrid, form ? styles.managementGridEditing : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.tableSection}>
          {!loading && (
            <DataTable
              ariaLabel="자산 계정 목록"
              columns={columns}
              rows={visibleAccounts}
              getRowKey={(row) => row.id}
              emptyMessage={ownerFilter === "all"
                ? "등록된 자산 계정이 없습니다."
                : "선택한 소유자의 자산 계정이 없습니다."}
              onRowClick={startEdit}
              renderExpandedRow={(row) => (
                <div className={styles.accountDetail}>
                  <span>소유자 {row.owner_name}</span>
                  <span>{row.institution_name || "금융기관 없음"}</span>
                  {row.memo && <span>{row.memo}</span>}
                </div>
              )}
            />
          )}
        </div>

        {form && (
          <aside
            className={styles.editorPanel}
            aria-label={form.id ? "자산 계정 수정" : "자산 계정 추가"}
          >
            <div className={styles.editorHeader}>
              <h2>{form.id ? "계정 수정" : "계정 추가"}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="편집 닫기">
                ×
              </button>
            </div>
            <div className={styles.formFields}>
              <label>
                <span>소유자</span>
                <select
                  value={form.ownerUserId}
                  disabled={role !== "owner"}
                  onChange={(event) => setForm({
                    ...form,
                    ownerUserId: Number(event.target.value),
                  })}
                >
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name || `사용자 ${member.user_id}`}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>금융기관</span>
                <select
                  value={form.institutionId ?? ""}
                  onChange={(event) => setForm({
                    ...form,
                    institutionId: event.target.value ? Number(event.target.value) : null,
                  })}
                >
                  <option value="">금융기관 없음</option>
                  {institutions
                    .filter((item) => item.is_active || item.id === form.institutionId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.institution_name}
                        {item.is_active ? "" : " (사용 종료)"}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>계정명</span>
                <input
                  value={form.accountName}
                  onChange={(event) => setForm({ ...form, accountName: event.target.value })}
                  placeholder="예: 급여 통장"
                />
              </label>

              <label>
                <span>계정 구분</span>
                <select
                  value={form.accountTypeId}
                  onChange={(event) => setForm({
                    ...form,
                    accountTypeId: Number(event.target.value),
                  })}
                >
                  {types
                    .filter((item) => item.is_active || item.id === form.accountTypeId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.type_name}
                        {item.is_active ? "" : " (사용 종료)"}
                      </option>
                    ))}
                </select>
              </label>

              {selectedType && (
                <p className={styles.fieldInfo}>
                  가용재산 포함: {selectedType.asset_kind === "ASSET"
                    && !!selectedType.allows_available ? "O" : "X"} (계정 구분 기준 자동 적용)
                </p>
              )}

              <label>
                <span>메모</span>
                <textarea
                  rows={4}
                  value={form.memo}
                  onChange={(event) => setForm({ ...form, memo: event.target.value })}
                />
              </label>

              {form.id && (
                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  />
                  <span>사용 중</span>
                </label>
              )}

              {selectedType?.requires_institution && !form.institutionId && (
                <p className={styles.fieldHint}>
                  이 계정 구분은 금융기관 선택이 필수입니다.
                </p>
              )}
            </div>

            <div className={styles.editorActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setForm(null)}
              >
                취소
              </button>
          {form.id && (
            <button
              type="button"
              className={styles.deleteButton}
              disabled={saving}
              onClick={() => setDeleteTarget({ id: form.id!, name: form.accountName })}
            >
              삭제
            </button>
          )}
              <button
                type="button"
                className={styles.primaryButton}
                disabled={saving || !form.accountName.trim() || !form.accountTypeId}
                onClick={() => void submit()}
              >
                {saving ? "저장 중" : "저장"}
              </button>
            </div>
          </aside>
        )}
      </div>

      <LoadingOverlay active={loading} label="자산 계정 로딩 중" />

      <ConfirmDialog
        open={!!deleteTarget}
        title="자산 계정 삭제"
        message={`${deleteTarget?.name ?? "선택 계정"}을 삭제하시겠습니까? 월별 잔액이 있으면 과거 기록 보존을 위해 사용 종료 처리됩니다.`}
        cancelLabel="취소"
        confirmLabel="삭제"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
