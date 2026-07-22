import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, TablePagination, type DataTableColumn } from "./DataTable";

type Row = { id: number; name: string; amount: string };

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "계정명", render: (row) => row.name },
  { key: "amount", header: "잔액", align: "right", render: (row) => row.amount },
];

// 공통 테이블의 기본 행과 빈 상태 렌더링 확인
describe("DataTable", () => {
  it("열 정의에 따라 행을 표시하고 키보드로 행을 선택한다", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        ariaLabel="자산 계정"
        columns={columns}
        rows={[{ id: 1, name: "급여통장", amount: "14,000,000원" }]}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    expect(screen.getByRole("table", { name: "자산 계정" })).toBeInTheDocument();
    const row = screen.getByText("급여통장").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.keyDown(row!, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith({ id: 1, name: "급여통장", amount: "14,000,000원" });
  });

  it("행이 없으면 지정한 안내 문구를 표시한다", () => {
    render(
      <DataTable
        ariaLabel="빈 자산 계정"
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        emptyMessage="등록된 자산 계정이 없습니다."
      />,
    );

    expect(screen.getByText("등록된 자산 계정이 없습니다.")).toBeInTheDocument();
  });
});

// 공통 페이지 번호와 양옆 이동 버튼 동작 확인
describe("TablePagination", () => {
  it("페이지 번호와 다음 버튼으로 이동한다", () => {
    const onPageChange = vi.fn();
    render(<TablePagination page={2} totalPages={3} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole("button", { name: "3 페이지" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 페이지" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });
});
