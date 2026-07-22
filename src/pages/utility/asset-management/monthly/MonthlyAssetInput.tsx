import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAssetAccounts,
  getMonthlyAssetInput,
  saveMonthlyAssetBalances,
  type AssetMember,
  type MonthlyAssetAccount,
} from "../../../../api/assetApi";
import { TableInput } from "../../../../common/input";
import { LoadingOverlay } from "../../../../common/loading";
import { DataTable, type DataTableColumn } from "../../../../common/table";
import type { AssetScreenProps } from "../types";
import styles from "../AssetManagement.module.css";

const currentYearMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const formatAmount = (value: string | null) => (
  value === null || value === "" ? "" : BigInt(value).toLocaleString("ko-KR")
);
const formatWon = (value: bigint) => `${value.toLocaleString("ko-KR")}원`;
const formatChange = (value: bigint) => (
  `${value > 0n ? "+" : ""}${value.toLocaleString("ko-KR")}원`
);
const savedTime = (value: string | null) => (
  value ? `마지막 저장 ${value.slice(0, 16).replace("T", " ")}` : "저장 이력 없음"
);

export default function MonthlyAssetInput({ calendarId, calendarName, calendarControl }: AssetScreenProps) {
  const navigate = useNavigate();
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [members, setMembers] = useState<AssetMember[]>([]);
  const [ownerUserId, setOwnerUserId] = useState(0);
  const [accounts, setAccounts] = useState<MonthlyAssetAccount[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 선택한 기준 월의 계정과 저장된 잔액 조회
  useEffect(() => {
    let active = true;

    setMembers([]);
    setOwnerUserId(0);
    setAccounts([]);
    setLoading(true);
    setMessage("");

    void getAssetAccounts(calendarId)
      .then((data) => {
        if (!active) return;

        setMembers(data.members);
        const defaultMember = data.members.find(
          (member) => member.user_id === data.currentUserId,
        ) ?? data.members[0];
        setOwnerUserId(defaultMember?.user_id ?? 0);
      })
      .catch((error: Error) => {
        if (active) {
          setMessage(error.message);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [calendarId]);

  useEffect(() => {
    if (!ownerUserId) return;

    let active = true;
    setLoading(true);
    setMessage("");

    void getMonthlyAssetInput(calendarId, ownerUserId, yearMonth)
      .then((data) => {
        if (!active) return;

        setAccounts(data.accounts);
        setLastSavedAt(data.lastSavedAt);
        setCanEdit(data.canEdit);
        setValues(Object.fromEntries(
          data.accounts.map((account) => [account.id, account.balance ?? ""]),
        ));
      })
      .catch((error: Error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [calendarId, ownerUserId, yearMonth]);

  // 현재 입력값을 기준으로 요약 카드와 미입력 개수 계산
  const totals = useMemo(() => accounts.reduce((result, account) => {
    const raw = values[account.id] ?? "";

    if (raw === "") {
      result.missing += 1;
      return result;
    }

    const amount = BigInt(raw);
    if (account.assetKind === "ASSET") result.assets += amount;
    else result.liabilities += amount;

    if (account.assetKind === "ASSET" && account.isAvailable === 1) {
      result.available += amount;
    }

    return result;
  }, {
    assets: 0n,
    liabilities: 0n,
    available: 0n,
    missing: 0,
  }), [accounts, values]);

  // 전월 저장 잔액을 합산해 입력 중인 이번 달 합계와 비교
  const previousTotals = useMemo(() => accounts.reduce((result, account) => {
    if (account.previousBalance === null) return result;

    const amount = BigInt(account.previousBalance);
    if (account.assetKind === "ASSET") result.assets += amount;
    else result.liabilities += amount;

    if (account.assetKind === "ASSET" && account.isAvailable === 1) {
      result.available += amount;
    }

    return result;
  }, {
    assets: 0n,
    liabilities: 0n,
    available: 0n,
  }), [accounts]);

  const changes = {
    assets: totals.assets - previousTotals.assets,
    liabilities: totals.liabilities - previousTotals.liabilities,
    netAssets: (totals.assets - totals.liabilities)
      - (previousTotals.assets - previousTotals.liabilities),
    available: totals.available - previousTotals.available,
  };

  const columns = useMemo<DataTableColumn<MonthlyAssetAccount>[]>(() => [
    {
      key: "institution",
      header: "금융기관",
      render: (account) => account.institutionName ?? "-",
    },
    {
      key: "accountName",
      header: "계정명",
      className: styles.monthlyAccountName,
      render: (account) => account.accountName,
    },
    {
      key: "typeName",
      header: "계정 구분",
      render: (account) => account.typeName,
    },
    {
      key: "previousBalance",
      header: "전월 잔액",
      align: "right",
      width: 150,
      render: (account) => account.previousBalance === null
        ? "-"
        : formatWon(BigInt(account.previousBalance)),
    },
    {
      key: "balance",
      header: "이번 달 잔액",
      align: "right",
      width: 190,
      className: styles.currentBalanceColumn,
      render: (account) => {
        const raw = values[account.id] ?? "";

        return (
          <div
            className={styles.balanceCellControl}
            onClick={(event) => event.currentTarget.querySelector("input")?.focus()}
          >
            <TableInput
              aria-label={`${account.accountName} 잔액`}
              inputMode="numeric"
              disabled={!canEdit || saving}
              value={formatAmount(raw)}
              placeholder="0"
              rightSlot="원"
              className={styles.monthlyTableInput}
              onChange={(event) => setValues((current) => ({
                ...current,
                [account.id]: event.target.value
                  .replace(/[^0-9]/g, "")
                  .replace(/^0+(?=\d)/, ""),
              }))}
            />
          </div>
        );
      },
    },
    {
      key: "difference",
      header: "전월 대비 증감",
      align: "right",
      width: 150,
      render: (account) => {
        const raw = values[account.id] ?? "";
        const difference = raw !== "" && account.previousBalance !== null
          ? BigInt(raw) - BigInt(account.previousBalance)
          : null;

        return difference === null
          ? "-"
          : `${difference > 0n ? "+" : ""}${difference.toLocaleString("ko-KR")}원`;
      },
    },
  ], [canEdit, saving, values]);

  const save = async () => {
    setSaving(true);
    setMessage("");

    try {
      const balances = accounts.map((account) => ({
        accountId: account.id,
        balance: values[account.id] === "" ? null : values[account.id],
      }));
      const data = await saveMonthlyAssetBalances(
        calendarId,
        ownerUserId,
        yearMonth,
        balances,
      );

      setLastSavedAt(data.savedAt);
      setMessage("저장했습니다.");

      const refreshed = await getMonthlyAssetInput(
        calendarId,
        ownerUserId,
        yearMonth,
      );
      setAccounts(refreshed.accounts);
      setLastSavedAt(refreshed.lastSavedAt);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.screen}>
      <header className={styles.screenHeader}>
        <div>
          <h1>월별 자산 입력</h1>
          <p>{calendarName} · 선택한 구성원의 활성 계정 잔액을 관리합니다.</p>
        </div>

        <div className={styles.screenHeaderActions}>
          {calendarControl}
          <label className={styles.memberPicker}>
            구성원
            <select
              value={ownerUserId || ""}
              disabled={members.length === 0 || saving}
              onChange={(event) => setOwnerUserId(Number(event.target.value))}
            >
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.monthPicker}>
            기준 월
            <input
              type="month"
              value={yearMonth}
              onChange={(event) => setYearMonth(event.target.value)}
            />
          </label>
        </div>
      </header>

      <div className={styles.monthlySummary}>
        <div>
          <span>총자산</span>
          <strong>{formatWon(totals.assets)}</strong>
          <small>전월 대비 {formatChange(changes.assets)}</small>
        </div>
        <div>
          <span>총부채</span>
          <strong>{formatWon(totals.liabilities)}</strong>
          <small>전월 대비 {formatChange(changes.liabilities)}</small>
        </div>
        <div>
          <span>순자산</span>
          <strong>{formatWon(totals.assets - totals.liabilities)}</strong>
          <small>전월 대비 {formatChange(changes.netAssets)}</small>
        </div>
        <div>
          <span>가용재산</span>
          <strong>{formatWon(totals.available)}</strong>
          <small>전월 대비 {formatChange(changes.available)}</small>
        </div>
      </div>

      {message && (
        <p className={message === "저장했습니다." ? styles.successMessage : styles.message}>
          {message}
        </p>
      )}

      {!loading && (accounts.length === 0 ? (
        <div className={styles.monthlyEmpty}>
          <p>선택한 구성원에게 입력할 활성 자산 계정이 없습니다.</p>
          <button
            className={styles.primaryButton}
            onClick={() => navigate("/asset-management/accounts")}
          >
            자산 계정 관리로 이동
          </button>
        </div>
      ) : (
        <DataTable
          ariaLabel="월별 자산 입력"
          columns={columns}
          rows={accounts}
          getRowKey={(account) => account.id}
          minWidth={850}
        />
      ))}

      {accounts.length > 0 && (
        <footer className={styles.monthlyActions}>
          <span>
            {totals.missing > 0 ? `미입력 ${totals.missing}개 · ` : ""}
            {savedTime(lastSavedAt)}
          </span>

          {canEdit && (
            <button
              className={styles.primaryButton}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          )}
        </footer>
      )}

      <LoadingOverlay active={loading} label="월별 자산 로딩 중" />
    </section>
  );
}
