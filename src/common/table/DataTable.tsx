import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import styles from "./DataTable.module.css";

export type DataTableColumn<Row> = {
  key: string;
  header: ReactNode;
  align?: "left" | "center" | "right";
  width?: CSSProperties["width"];
  className?: string;
  render: (row: Row) => ReactNode;
};

export type DataTableExpandedTableRow = {
  key: string | number;
  cells: ReactNode[];
  className?: string;
};

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  ariaLabel: string;
  emptyMessage?: string;
  minWidth?: CSSProperties["minWidth"];
  className?: string;
  onRowClick?: (row: Row) => void;
  expandedRowKey?: string | number | null;
  expandedRowKeys?: ReadonlyArray<string | number>;
  renderExpandedRow?: (row: Row) => ReactNode;
  renderExpandedTableRows?: (row: Row) => DataTableExpandedTableRow[];
  integratedExpansion?: boolean;
};

const alignClassNames = {
  left: styles.alignLeft,
  center: styles.alignCenter,
  right: styles.alignRight,
};

// 공통 테이블 헤더·행·빈 상태와 선택 행 상세 렌더링
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  ariaLabel,
  emptyMessage = "표시할 데이터가 없습니다.",
  minWidth,
  className = "",
  onRowClick,
  expandedRowKey = null,
  expandedRowKeys,
  renderExpandedRow,
  renderExpandedTableRows,
  integratedExpansion = false,
}: DataTableProps<Row>) {
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className={[styles.tableFrame, className].filter(Boolean).join(" ")}>
      <div className={styles.scrollArea}>
        <table className={styles.table} aria-label={ariaLabel} style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={[
                    alignClassNames[column.align ?? "left"],
                    column.className ?? "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowKey = getRowKey(row);
                const expanded = expandedRowKeys
                  ? expandedRowKeys.includes(rowKey)
                  : expandedRowKey !== null && rowKey === expandedRowKey;

                return (
                  <FragmentRow
                    key={rowKey}
                    row={row}
                    rowKey={rowKey}
                    columns={columns}
                    interactive={!!onRowClick}
                    expanded={expanded}
                    onClick={onRowClick}
                    onKeyDown={handleRowKeyDown}
                    renderExpandedRow={renderExpandedRow}
                    renderExpandedTableRows={renderExpandedTableRows}
                    integratedExpansion={integratedExpansion}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type FragmentRowProps<Row> = {
  row: Row;
  rowKey: string | number;
  columns: DataTableColumn<Row>[];
  interactive: boolean;
  expanded: boolean;
  onClick?: (row: Row) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => void;
  renderExpandedRow?: (row: Row) => ReactNode;
  renderExpandedTableRows?: (row: Row) => DataTableExpandedTableRow[];
  integratedExpansion: boolean;
};

// 기본 행과 선택 시 이어지는 상세 행을 하나의 묶음으로 렌더링
function FragmentRow<Row>({
  row,
  rowKey,
  columns,
  interactive,
  expanded,
  onClick,
  onKeyDown,
  renderExpandedRow,
  renderExpandedTableRows,
  integratedExpansion,
}: FragmentRowProps<Row>) {
  return (
    <>
      <tr
        className={[
          interactive ? styles.interactiveRow : "",
          expanded && integratedExpansion ? styles.integratedParentRow : "",
        ].filter(Boolean).join(" ") || undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-expanded={interactive && (renderExpandedRow || renderExpandedTableRows) ? expanded : undefined}
        onClick={onClick ? () => onClick(row) : undefined}
        onKeyDown={interactive ? (event) => onKeyDown(event, row) : undefined}
      >
        {columns.map((column) => (
          <td
            key={`${rowKey}-${column.key}`}
            className={[
              alignClassNames[column.align ?? "left"],
              column.className ?? "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ width: column.width }}
          >
            {column.render(row)}
          </td>
        ))}
      </tr>
      {expanded && renderExpandedRow && (
        <tr className={[
          styles.expandedRow,
          integratedExpansion ? styles.integratedExpandedRow : "",
        ].filter(Boolean).join(" ")}>
          <td colSpan={columns.length}>{renderExpandedRow(row)}</td>
        </tr>
      )}
      {expanded && renderExpandedTableRows?.(row).map((detailRow) => (
        <tr
          key={`${rowKey}-detail-${detailRow.key}`}
          className={[styles.expandedTableRow, detailRow.className ?? ""]
            .filter(Boolean)
            .join(" ")}
        >
          {columns.map((column, index) => (
            <td
              key={`${rowKey}-detail-${detailRow.key}-${column.key}`}
              className={[
                alignClassNames[column.align ?? "left"],
                column.className ?? "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ width: column.width }}
            >
              {detailRow.cells[index] ?? null}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

type TablePaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
};

// 이전·다음과 실제 페이지 번호를 제공하는 공통 페이지 이동
export function TablePagination({
  page,
  totalPages,
  onPageChange,
  ariaLabel = "페이지 이동",
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label={ariaLabel}>
      <button
        type="button"
        className={styles.pageArrow}
        disabled={page <= 1}
        aria-label="이전 페이지"
        onClick={() => onPageChange(page - 1)}
      >
        <span className={`${styles.chevron} ${styles.chevronLeft}`} aria-hidden="true" />
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
        <button
          type="button"
          key={pageNumber}
          className={[styles.pageNumber, pageNumber === page ? styles.pageNumberActive : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={`${pageNumber} 페이지`}
          aria-current={pageNumber === page ? "page" : undefined}
          onClick={() => onPageChange(pageNumber)}
        >
          {pageNumber}
        </button>
      ))}
      <button
        type="button"
        className={styles.pageArrow}
        disabled={page >= totalPages}
        aria-label="다음 페이지"
        onClick={() => onPageChange(page + 1)}
      >
        <span className={`${styles.chevron} ${styles.chevronRight}`} aria-hidden="true" />
      </button>
    </nav>
  );
}
