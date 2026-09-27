import type { WorkSheet } from "xlsx";

type SheetJs = typeof import("xlsx");

/**
 * 구형 XLS의 잘못되거나 축소된 !ref 범위와 중간 빈 행에 영향을 받지 않고
 * 엑셀에 표시되는 실제 행 번호 그대로 2차원 배열을 만든다.
 */
export function worksheetToRows(XLSX: SheetJs, worksheet: WorkSheet): unknown[][] {
  let lastRow = -1;
  let lastColumn = -1;

  if (worksheet["!ref"]) {
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    lastRow = range.e.r;
    lastColumn = range.e.c;
  }

  for (const address of Object.keys(worksheet)) {
    if (address.startsWith("!")) continue;
    try {
      const position = XLSX.utils.decode_cell(address);
      lastRow = Math.max(lastRow, position.r);
      lastColumn = Math.max(lastColumn, position.c);
    } catch {
      // 셀 주소가 아닌 라이브러리 메타데이터는 건너뛴다.
    }
  }

  if (lastRow < 0 || lastColumn < 0) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: true,
    range: { s: { r: 0, c: 0 }, e: { r: lastRow, c: lastColumn } },
  });
}
