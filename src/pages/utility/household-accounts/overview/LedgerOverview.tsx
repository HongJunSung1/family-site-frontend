import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import { ApiError } from "../../../../api/client";
import {
  getLedgerOverview,
  type LedgerOverviewData,
  type LedgerOverviewRecent,
} from "../../../../api/ledgerApi";
import { AlertDialog } from "../../../../common/dialog";
import { LoadingOverlay } from "../../../../common/loading";
import { DataTable, type DataTableColumn } from "../../../../common/table";
import type { LedgerScreenProps } from "../types";
import styles from "../HouseholdAccounts.module.css";

const currentMonth = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
const shiftMonth = (value: string, offset: number) => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const money = (value: string) => `${BigInt(value).toLocaleString("ko-KR")}원`;
const kindLabel = { INCOME: "수입", EXPENSE: "지출", TRANSFER: "이체" } as const;
type SearchField = "rootName" | "middleName" | "leafName" | "description" | "counterparty";
type CategoryLevel = "root" | "middle" | "leaf";
type CategoryAggregate = {
  id: string; rootName: string; middleName?: string; leafName?: string;
  income: string; expense: string;
};

export default function LedgerOverview({ calendarId, calendarControl }: LedgerScreenProps) {
  const [startMonth, setStartMonth] = useState(currentMonth());
  const [endMonth, setEndMonth] = useState(currentMonth());
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [data, setData] = useState<LedgerOverviewData | null>(null);
  const [searchField, setSearchField] = useState<SearchField>("description");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryKind, setCategoryKind] = useState<"income" | "expense">("expense");
  const [categoryLevel, setCategoryLevel] = useState<CategoryLevel>("middle");
  const [aggregateLevel, setAggregateLevel] = useState<CategoryLevel>("root");
  const [recentKind, setRecentKind] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchField; query: string }>({
    field: "description", query: "",
  });
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!calendarId) return;
    setLoading(true);
    try {
      const result = await getLedgerOverview(calendarId, startMonth, endMonth, ownerId === 0 ? "all" : ownerId ?? undefined);
      setData(result);
      if (ownerId === null) setOwnerId(result.currentUserId);
    } catch (error) {
      setAlert({
        title: "조회 실패",
        message: error instanceof ApiError ? error.message : "가계부 현황을 불러오지 못했습니다.",
      });
    } finally {
      setLoading(false);
    }
  }, [calendarId, endMonth, ownerId, startMonth]);
  useEffect(() => { void load(); }, [load]);

  const rootAggregates = useMemo(() => {
    const totals = new Map<number, CategoryAggregate>();
    for (const item of data?.categories ?? []) {
      const current = totals.get(item.rootId) ?? {
        id: String(item.rootId), rootName: item.rootName, income: "0", expense: "0",
      };
      current.income = (BigInt(current.income) + BigInt(item.income)).toString();
      current.expense = (BigInt(current.expense) + BigInt(item.expense)).toString();
      totals.set(item.rootId, current);
    }
    return [...totals.values()].sort((a, b) => a.rootName.localeCompare(b.rootName, "ko"));
  }, [data]);
  const middleAggregates = useMemo<CategoryAggregate[]>(() => (data?.categories ?? []).map((item) => ({
    id: `${item.rootId}-${item.middleId}`, rootName: item.rootName, middleName: item.middleName,
    income: item.income, expense: item.expense,
  })), [data]);
  const leafAggregates = useMemo<CategoryAggregate[]>(() => (data?.leafCategories ?? []).map((item) => ({
    id: String(item.leafId), rootName: item.rootName, middleName: item.middleName, leafName: item.leafName,
    income: item.income, expense: item.expense,
  })), [data]);
  const categoryStatusItems = useMemo(() => {
    const source = categoryLevel === "root" ? rootAggregates
      : categoryLevel === "middle" ? middleAggregates : leafAggregates;
    return source.filter((item) => BigInt(item[categoryKind]) !== 0n)
      .sort((a, b) => {
        const aValue = BigInt(a[categoryKind]);
        const bValue = BigInt(b[categoryKind]);
        const aAbsolute = aValue < 0n ? -aValue : aValue;
        const bAbsolute = bValue < 0n ? -bValue : bValue;
        return aAbsolute > bAbsolute ? -1 : aAbsolute < bAbsolute ? 1 : 0;
      });
  }, [categoryKind, categoryLevel, leafAggregates, middleAggregates, rootAggregates]);
  const filteredRecent = useMemo(() => {
    const query = appliedSearch.query.trim().toLocaleLowerCase("ko");
    return (data?.recent ?? []).filter((item) =>
      (recentKind === "ALL" || item.transactionKind === recentKind)
      && (!query || item[appliedSearch.field].toLocaleLowerCase("ko").includes(query)));
  }, [appliedSearch, data, recentKind]);
  const recentTotals = useMemo(() => filteredRecent.reduce((totals, item) => {
    const value = BigInt(item.amount.replace("-", ""));
    const signedValue = item.isReversal ? -value : value;
    if (item.transactionKind === "INCOME") totals.income += signedValue;
    if (item.transactionKind === "EXPENSE") totals.expense += signedValue;
    if (item.transactionKind === "TRANSFER" && item.amount.startsWith("-")) totals.transferOutflow += value;
    if (item.transactionKind === "TRANSFER" && !item.amount.startsWith("-")) totals.transferInflow += value;
    return totals;
  }, { income: 0n, expense: 0n, transferInflow: 0n, transferOutflow: 0n }), [filteredRecent]);
  const submitSearch = () => setAppliedSearch({ field: searchField, query: searchQuery });
  const barWidth = (item: CategoryAggregate, field: "income" | "expense", max: bigint) => {
    const value = BigInt(item[field]);
    const absolute = value < 0n ? -value : value;
    return `${Number((absolute * 1000n) / max) / 10}%`;
  };
  const categoryPanel = (items: CategoryAggregate[], field: "income" | "expense") => {
    const max = items.reduce((value, item) => {
      const current = BigInt(item[field]);
      const absolute = current < 0n ? -current : current;
      return absolute > value ? absolute : value;
    }, 1n);
    return <section className={styles.overviewPanel}>
      <div className={styles.categoryStatusHeader}>
        <div className={styles.categoryStatusTabs} role="tablist" aria-label="수입 지출 현황">
          <button type="button" role="tab" aria-selected={categoryKind === "income"} onClick={() => setCategoryKind("income")}>수입 현황</button>
          <button type="button" role="tab" aria-selected={categoryKind === "expense"} onClick={() => setCategoryKind("expense")}>지출 현황</button>
        </div>
        <select aria-label="분류 현황 단계" value={categoryLevel} onChange={(event) => setCategoryLevel(event.target.value as CategoryLevel)}>
          <option value="root">대분류별</option>
          <option value="middle">중분류별</option>
          <option value="leaf">소분류별</option>
        </select>
      </div>
      {items.length ? <div className={styles.categoryBars}>
        <div className={`${styles.categoryStatusRow} ${styles.categoryStatusColumnHeader}`}>
          <div className={styles.categoryStatusNames} data-level={categoryLevel}>
            <span>대분류</span>
            {categoryLevel !== "root" && <span>중분류</span>}
            {categoryLevel === "leaf" && <span>소분류</span>}
          </div>
          <span>비율</span><span>금액</span>
        </div>
        {items.map((item) => (
        <div key={item.id} className={styles.categoryBarRow}>
          <div className={styles.categoryStatusNames} data-level={categoryLevel}>
            <strong title={item.rootName}>{item.rootName}</strong>
            {categoryLevel !== "root" && <strong title={item.middleName}>{item.middleName}</strong>}
            {categoryLevel === "leaf" && <strong title={item.leafName}>{item.leafName}</strong>}
          </div>
          <div className={styles.categoryBarTrack}><i style={{ width: barWidth(item, field, max) }} /></div>
          <b>{money(item[field])}</b>
        </div>
      ))}</div> : <p className={styles.overviewEmpty}>조회된 {field === "income" ? "수입" : "지출"} 거래가 없습니다.</p>}
    </section>;
  };
  const recentColumns: DataTableColumn<LedgerOverviewRecent>[] = [
    { key: "date", header: "일자", width: 105, className: styles.overviewDateCell, render: (row) => row.transactionDate },
    { key: "root", header: "대분류", width: 95, render: (row) => <span className={styles.overviewEllipsis}>{row.rootName}</span> },
    { key: "middle", header: "중분류", width: 95, render: (row) => <span className={styles.overviewEllipsis}>{row.middleName}</span> },
    { key: "leaf", header: "소분류", width: 105, render: (row) => <span className={styles.overviewEllipsis}>{row.leafName}</span> },
    { key: "description", header: "거래내용", render: (row) => <span className={styles.overviewEllipsis}>{row.description}</span> },
    { key: "counterparty", header: "거래처명", width: 130, render: (row) => <span className={styles.overviewEllipsis}>{row.counterparty || "-"}</span> },
    { key: "owner", header: "소유자", width: 100, render: (row) => row.ownerName },
    { key: "kind", header: "성격", width: 85, render: (row) => row.isReversal ? `${kindLabel[row.transactionKind]} 취소` : kindLabel[row.transactionKind] },
    { key: "amount", header: "금액", width: 130, className: styles.amountCell, render: (row) => money(row.isReversal ? `-${row.amount.replace("-", "")}` : row.amount) },
  ];
  const rootColumns: DataTableColumn<CategoryAggregate>[] = [
    { key: "category", header: "분류", render: (row) => <strong className={styles.overviewAggregateRoot}>{row.rootName}</strong> },
    { key: "income", header: "수입", width: 120, className: styles.amountCell, render: (row) => money(row.income) },
    { key: "expense", header: "지출", width: 120, className: styles.amountCell, render: (row) => money(row.expense) },
  ];
  const middleColumns: DataTableColumn<CategoryAggregate>[] = [
    { key: "root", header: "대분류", render: (row) => <span className={styles.overviewEllipsis}>{row.rootName}</span> },
    { key: "middle", header: "중분류", render: (row) => <span className={styles.overviewEllipsis}>{row.middleName}</span> },
    { key: "income", header: "수입", width: 110, className: styles.amountCell, render: (row) => money(row.income) },
    { key: "expense", header: "지출", width: 110, className: styles.amountCell, render: (row) => money(row.expense) },
  ];
  const leafColumns: DataTableColumn<CategoryAggregate>[] = [
    { key: "root", header: "대분류", render: (row) => <span className={styles.overviewEllipsis}>{row.rootName}</span> },
    { key: "middle", header: "중분류", render: (row) => <span className={styles.overviewEllipsis}>{row.middleName}</span> },
    { key: "leaf", header: "소분류", render: (row) => <span className={styles.overviewEllipsis}>{row.leafName}</span> },
    { key: "income", header: "수입", width: 105, className: styles.amountCell, render: (row) => money(row.income) },
    { key: "expense", header: "지출", width: 105, className: styles.amountCell, render: (row) => money(row.expense) },
  ];

  return (
    <section className={styles.screen}>
      <header className={styles.screenHeader}>
        <h1>가계부 현황</h1>
        <div className={styles.screenHeaderActions}>
          {calendarControl}
          <label className={styles.monthRangeControl}>시작 월<input className={styles.filterControl} aria-label="시작 월" type="month" value={startMonth} min={shiftMonth(endMonth, -23)} max={endMonth} onChange={(event) => setStartMonth(event.target.value)} /></label>
          <label className={styles.monthRangeControl}>종료 월<input className={styles.filterControl} aria-label="종료 월" type="month" value={endMonth} min={startMonth} max={shiftMonth(startMonth, 23)} onChange={(event) => setEndMonth(event.target.value)} /></label>
          <select className={styles.filterControl} aria-label="소유자" value={ownerId ?? ""} onChange={(event) => setOwnerId(Number(event.target.value))}>
            {ownerId === null && <option value="">불러오는 중</option>}
            <option value={0}>전체 구성원</option>
            {data?.members.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
          </select>
        </div>
      </header>

      <div className={styles.overviewTopGrid}>
        <section className={styles.ledgerSummaryCard}>
          <h2>수입·지출 요약</h2>
          <div><span>수입</span><strong>{money(data?.totals.income ?? "0")}</strong></div>
          <div><span>지출</span><strong>{money(data?.totals.expense ?? "0")}</strong></div>
          <div className={styles.summaryBalanceRow}><span>수입 - 지출</span><strong>{money(data?.totals.balance ?? "0")}</strong></div>
          <div><span>이체</span><strong className={styles.transferSummary}><small>입금</small>{money(data?.totals.transferInflow ?? "0")}<i>/</i><small>출금</small>{money(data?.totals.transferOutflow ?? "0")}</strong></div>
          <div className={styles.summaryBalanceRow}><span>순현금흐름</span><strong>{money(data?.totals.netCashFlow ?? "0")}</strong></div>
        </section>
        <section className={`${styles.overviewPanel} ${styles.ledgerHistoryPanel}`}>
          <h2>최근 12개월 수입·지출 추이</h2>
          <div className={styles.ledgerHistoryChart} aria-label="최근 12개월 수입 지출 차액 그래프">
            <LineChart
              height={280}
              xAxis={[{
                scaleType: "point", data: (data?.history ?? []).map((point) => point.month.slice(2).replace("-", ".")),
                tickLabelStyle: { fontSize: 9 },
              }]}
              yAxis={[{ width: 58, valueFormatter: (value: number) => value.toLocaleString("ko-KR"), tickLabelStyle: { fontSize: 9 } }]}
              series={[
                { id: "income", label: "수입", color: "#2c9b67", data: (data?.history ?? []).map((point) => Number(point.income)), valueFormatter: (value) => value === null ? "-" : `${value.toLocaleString("ko-KR")}원` },
                { id: "expense", label: "지출", color: "#df6262", data: (data?.history ?? []).map((point) => Number(point.expense)), valueFormatter: (value) => value === null ? "-" : `${value.toLocaleString("ko-KR")}원` },
                { id: "balance", label: "수입 - 지출", color: "#6385ff", data: (data?.history ?? []).map((point) => Number(point.balance)), valueFormatter: (value) => value === null ? "-" : `${value.toLocaleString("ko-KR")}원` },
              ]}
              grid={{ horizontal: true }}
              margin={{ left: 0, right: 34, top: 12, bottom: 30 }}
            />
          </div>
        </section>
      </div>

      <div className={styles.overviewGrid}>
        {categoryPanel(categoryStatusItems, categoryKind)}

        <section className={styles.overviewPanel}>
          <div className={styles.aggregateHeader}>
            <h2>분류별 집계</h2>
            <div className={styles.aggregateToolbar}>
              <div className={styles.categoryStatusTabs} role="tablist" aria-label="분류별 집계 단계">
                <button type="button" role="tab" aria-selected={aggregateLevel === "root"} onClick={() => setAggregateLevel("root")}>대분류</button>
                <button type="button" role="tab" aria-selected={aggregateLevel === "middle"} onClick={() => setAggregateLevel("middle")}>중분류</button>
                <button type="button" role="tab" aria-selected={aggregateLevel === "leaf"} onClick={() => setAggregateLevel("leaf")}>소분류</button>
              </div>
              <div className={styles.aggregateTotals}>
                <span>수입 <strong>{money(data?.totals.income ?? "0")}</strong></span>
                <span>지출 <strong>{money(data?.totals.expense ?? "0")}</strong></span>
              </div>
            </div>
          </div>
          <DataTable
            className={styles.overviewAggregateTable}
            ariaLabel={`${aggregateLevel === "root" ? "대분류" : aggregateLevel === "middle" ? "중분류" : "소분류"}별 집계`}
            columns={aggregateLevel === "root" ? rootColumns : aggregateLevel === "middle" ? middleColumns : leafColumns}
            rows={aggregateLevel === "root" ? rootAggregates : aggregateLevel === "middle" ? middleAggregates : leafAggregates}
            getRowKey={(row) => row.id}
            emptyMessage="조회된 분류별 거래가 없습니다."
          />
        </section>
      </div>

      <section className={styles.overviewPanel}>
        <div className={styles.overviewRecentHeader}>
          <h2>최근 거래</h2>
          <form className={styles.overviewSearch} onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
            <select aria-label="최근 거래 유형" value={recentKind} onChange={(event) => setRecentKind(event.target.value as typeof recentKind)}>
              <option value="ALL">전체</option>
              <option value="INCOME">수입</option>
              <option value="EXPENSE">지출</option>
            </select>
            <select aria-label="최근 거래 검색 기준" value={searchField} onChange={(event) => setSearchField(event.target.value as SearchField)}>
              <option value="rootName">대분류</option>
              <option value="middleName">중분류</option>
              <option value="leafName">소분류</option>
              <option value="description">거래내용</option>
              <option value="counterparty">거래처명</option>
            </select>
            <input aria-label="최근 거래 검색어" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="검색어 입력" />
            <button type="submit" aria-label="최근 거래 검색"><span aria-hidden="true" /></button>
          </form>
        </div>
        <div className={styles.recentTotalsRow}>
          <strong>조회 합계</strong>
          <span>수입 <b>{money(recentTotals.income.toString())}</b></span>
          <span>지출 <b>{money(recentTotals.expense.toString())}</b></span>
          {recentKind === "ALL" && <>
            <span>이체 입금 <b>{money(recentTotals.transferInflow.toString())}</b></span>
            <span>이체 출금 <b>{money(recentTotals.transferOutflow.toString())}</b></span>
          </>}
        </div>
        <DataTable className={styles.overviewRecentTable} ariaLabel="최근 거래" minWidth={1080} columns={recentColumns} rows={filteredRecent} getRowKey={(row) => row.id} emptyMessage={appliedSearch.query.trim() ? "검색 결과가 없습니다." : "조회된 거래가 없습니다."} />
      </section>
      <LoadingOverlay active={loading} label="가계부 현황 불러오는 중" />
      <AlertDialog open={!!alert} title={alert?.title ?? ""} message={alert?.message ?? ""} onClose={() => setAlert(null)} />
    </section>
  );
}
