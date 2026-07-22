import { useEffect, useMemo, useState } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { LineChart } from "@mui/x-charts/LineChart";
import {
  getAssetHistory,
  getAssetSummary,
  type AssetHistoryPoint,
  type AssetSummaryAccount,
  type AssetSummaryMember,
  type AssetTotals,
} from "../../../../api/assetApi";
import { DataTable, type DataTableColumn } from "../../../../common/table";
import { LoadingOverlay } from "../../../../common/loading";
import type { AssetScreenProps } from "../types";
import styles from "../AssetManagement.module.css";

const currentYearMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const emptyTotals: AssetTotals = {
  assets: "0",
  liabilities: "0",
  netAssets: "0",
  available: "0",
};
const formatWon = (value: string) => `${BigInt(value).toLocaleString("ko-KR")}원`;
const formatChange = (value: string) => (
  `${BigInt(value) > 0n ? "+" : ""}${BigInt(value).toLocaleString("ko-KR")}원`
);
const chartAmount = (value: string) => Number(value);

export default function AssetOverview({ calendarId, calendarName, calendarControl }: AssetScreenProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [totals, setTotals] = useState(emptyTotals);
  const [change, setChange] = useState(emptyTotals);
  const [members, setMembers] = useState<AssetSummaryMember[]>([]);
  const [accounts, setAccounts] = useState<AssetSummaryAccount[]>([]);
  const [history, setHistory] = useState<AssetHistoryPoint[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [expandedMemberIds, setExpandedMemberIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // 기준 월 요약과 최근 12개월 추이를 함께 조회
  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return null;
      setLoading(true);
      setMessage("");
      return Promise.all([
        getAssetSummary(calendarId, yearMonth),
        getAssetHistory(calendarId, yearMonth),
      ]);
    }).then((data) => {
      if (!data) return;
      const [summary, historyData] = data;
      if (!active) return;
      setTotals(summary.totals);
      setChange(summary.change);
      setMembers(summary.members);
      setAccounts(summary.accounts);
      setMissingCount(summary.missingCount);
      setHistory(historyData.history);
    }).catch((error: Error) => {
      if (active) setMessage(error.message);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [calendarId, yearMonth]);

  const memberColumns = useMemo<DataTableColumn<AssetSummaryMember>[]>(() => [
    {
      key: "name",
      header: "구성원",
      render: (member) => (
        <strong className={styles.memberSummaryName}>{member.name}</strong>
      ),
    },
    {
      key: "assets",
      header: "총자산",
      align: "right",
      render: (member) => (
        <strong className={styles.memberSummaryValue}>{formatWon(member.assets)}</strong>
      ),
    },
    {
      key: "liabilities",
      header: "총부채",
      align: "right",
      render: (member) => (
        <strong className={styles.memberSummaryValue}>{formatWon(member.liabilities)}</strong>
      ),
    },
    {
      key: "netAssets",
      header: "순자산",
      align: "right",
      render: (member) => (
        <strong className={styles.memberSummaryValue}>{formatWon(member.netAssets)}</strong>
      ),
    },
    {
      key: "available",
      header: "가용재산",
      align: "right",
      render: (member) => (
        <strong className={styles.memberSummaryValue}>{formatWon(member.available)}</strong>
      ),
    },
    {
      key: "missing",
      header: "비고",
      align: "center",
      width: 150,
      render: (member) => (
        <strong className={styles.memberSummaryNote}>
          {member.missing ? `${member.missing}개 미입력` : "-"}
        </strong>
      ),
    },
  ], []);

  return (
    <section className={styles.screen}>
      <header className={styles.screenHeader}>
        <div>
          <h1>자산현황</h1>
          <p>{calendarName} 구성원의 자산과 부채 현황입니다.</p>
        </div>
        <div className={styles.screenHeaderActions}>
          {calendarControl}
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

      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.overviewSummary}>
        {([
          ["총자산", totals.assets, change.assets, "기준 월에 입력된 모든 자산 계정의 잔액을 합산합니다."],
          ["총부채", totals.liabilities, change.liabilities, "기준 월에 입력된 모든 부채 계정의 잔액을 합산합니다."],
          ["순자산", totals.netAssets, change.netAssets, "총자산에서 총부채를 차감합니다."],
          ["가용재산", totals.available, change.available, "가용재산으로 설정된 자산 계정만 합산하며 부채는 차감하지 않습니다."],
        ] as const).map(([label, value, changed, description]) => (
          <div key={label}>
            <div className={styles.summaryCardHeader}>
              <span>{label}</span>
              <span className={styles.summaryHelp}>
                <button type="button" aria-label={`${label} 계산 방법`}>?</button>
                <span className={styles.summaryTooltip} role="tooltip">
                  {description}
                </span>
              </span>
            </div>
            <strong>{formatWon(value)}</strong>
            <small>전월 대비 {formatChange(changed)}</small>
          </div>
        ))}
      </div>

      {missingCount > 0 && (
        <p className={styles.overviewNotice}>
          기준 월 잔액이 입력되지 않은 계정이 {missingCount}개 있습니다.
        </p>
      )}

      {!loading && (
        <>
          <section className={styles.tableSection}>
            <div className={styles.sectionHeader}>
              <h2>구성원별 현황</h2>
              <span>행을 누르면 계정별 상세가 열립니다.</span>
            </div>
            <DataTable
              ariaLabel="구성원별 자산현황"
              columns={memberColumns}
              rows={members}
              getRowKey={(member) => member.userId}
              emptyMessage="표시할 자산 계정이 없습니다."
              minWidth={900}
              expandedRowKeys={expandedMemberIds}
              integratedExpansion
              onRowClick={(member) => setExpandedMemberIds((current) => (
                current.includes(member.userId)
                  ? current.filter((id) => id !== member.userId)
                  : [...current, member.userId]
              ))}
              renderExpandedTableRows={(member) => {
                const memberAccounts = accounts.filter((account) => account.ownerUserId === member.userId);

                return memberAccounts.map((account, index) => {
                  const previousChange = account.balance !== null
                    && account.previousBalance !== null
                    ? BigInt(account.balance) - BigInt(account.previousBalance)
                    : null;

                  return {
                      key: account.id,
                      className: [
                        styles.memberAccountRow,
                        index === memberAccounts.length - 1 ? styles.memberAccountRowLast : "",
                      ].filter(Boolean).join(" "),
                      cells: [
                        <div className={styles.memberAccountIdentity} key="identity">
                          <span
                            className={[
                              styles.assetKindBadge,
                              account.assetKind === "LIABILITY" ? styles.liabilityBadge : "",
                            ].filter(Boolean).join(" ")}
                          >
                            {account.assetKind === "ASSET" ? "자산" : "부채"}
                          </span>
                          <span className={styles.memberAccountInstitution}>
                            {account.institutionName ?? "금융기관 없음"}
                          </span>
                          <span className={styles.memberAccountType}>· {account.typeName}</span>
                          <strong>
                            <span className={styles.memberAccountSeparator} aria-hidden="true">· </span>
                            {account.accountName}
                          </strong>
                        </div>,
                        account.assetKind === "ASSET" && account.balance !== null
                          ? formatWon(account.balance)
                          : "-",
                        account.assetKind === "LIABILITY" && account.balance !== null
                          ? formatWon(account.balance)
                          : "-",
                        account.balance === null
                          ? "-"
                          : formatWon(account.assetKind === "ASSET"
                            ? account.balance
                            : (-BigInt(account.balance)).toString()),
                        account.assetKind === "ASSET"
                          && account.isAvailable === 1
                          && account.balance !== null
                          ? formatWon(account.balance)
                          : "-",
                        <small key="note" className={[
                          styles.memberAccountNote,
                          account.balance === null ? "" : styles.changeSummary,
                        ].filter(Boolean).join(" ")}>
                          {account.balance === null ? (
                            "미입력"
                          ) : (
                            <>
                              <span className={styles.changeLabel}>전월 대비</span>
                              <span
                                className={previousChange === null || previousChange === 0n
                                  ? undefined
                                  : previousChange > 0n
                                    ? styles.changeIncrease
                                    : styles.changeDecrease}
                              >
                                {previousChange === null ? "-" : formatChange(previousChange.toString())}
                              </span>
                            </>
                          )}
                        </small>,
                      ],
                    };
                });
              }}
            />
          </section>

          <section className={styles.chartSection}>
            <div className={styles.sectionHeader}>
              <h2>최근 12개월 자산 추이</h2>
              <span>단위: 원</span>
            </div>
            <div className={styles.assetChart}>
              <LineChart
                height={isMobile ? 276 : 300}
                xAxis={[{
                  scaleType: "point",
                  data: history.map((point) => point.month.slice(2).replace("-", ".")),
                }]}
                yAxis={[{
                  valueFormatter: (value: number) => value.toLocaleString("ko-KR"),
                }]}
                series={[
                  {
                    label: "순자산",
                    data: history.map((point) => (
                      point.entered ? chartAmount(point.netAssets) : null
                    )),
                    color: "#6385ff",
                    connectNulls: false,
                    valueFormatter: (value) => (
                      value === null ? "-" : `${value.toLocaleString("ko-KR")}원`
                    ),
                  },
                  {
                    label: "가용재산",
                    data: history.map((point) => (
                      point.entered ? chartAmount(point.available) : null
                    )),
                    color: "#42b883",
                    connectNulls: false,
                    valueFormatter: (value) => (
                      value === null ? "-" : `${value.toLocaleString("ko-KR")}원`
                    ),
                  },
                ]}
                slotProps={{
                  tooltip: {
                    classes: { paper: styles.assetChartTooltip },
                  },
                }}
                grid={{ horizontal: true }}
                margin={isMobile
                  ? { left: 8, right: 18, top: 16, bottom: 20 }
                  : { left: 72, right: 24, top: 24, bottom: 24 }}
              />
            </div>
          </section>
        </>
      )}

      <LoadingOverlay active={loading} label="자산현황 로딩 중" />
    </section>
  );
}
