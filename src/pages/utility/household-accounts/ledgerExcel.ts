import type { WorkBook, WorkSheet } from "xlsx";

type SheetJs = typeof import("xlsx");
export type LedgerWorkbookSheet = { name: string; rows: unknown[][] };
export type LedgerExcelDateFormat = "AUTO" | "YMD" | "YMDHMS" | "EXCEL_SERIAL";

const HEADER_NAMES = new Set([
  "no", "번호", "순번", "거래일", "거래일자", "거래일시", "거래시간", "일자", "날짜", "시간",
  "출금", "출금액", "입금", "입금액", "거래금액", "금액", "거래후잔액", "잔액",
  "거래내용", "적요", "내용", "송금메시지", "상대계좌번호", "상대은행", "거래구분",
  "수표어음금액", "cms코드", "상대계좌예금주명", "예금주명", "메모",
]);

const normalizedHeader = (value: unknown) => String(value ?? "")
  .trim()
  .toLocaleLowerCase("ko")
  .replace(/[\s_·()\-./]/g, "");

export function detectHeaderRow(rows: unknown[][]) {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 100).forEach((row, rowIndex) => {
    const score = row.reduce<number>((total, value) => total + (HEADER_NAMES.has(normalizedHeader(value)) ? 1 : 0), 0);
    if (score > bestScore) {
      bestIndex = rowIndex;
      bestScore = score;
    }
  });
  return bestScore >= 2 ? bestIndex + 1 : 1;
}

const ymd = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export function excelDateText(value: unknown, format: LedgerExcelDateFormat) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return ymd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number" || format === "EXCEL_SERIAL") {
    const serial = Number(value);
    if (Number.isFinite(serial)) {
      const parsed = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
      if (!Number.isNaN(parsed.getTime())) return ymd(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
    }
  }
  const raw = String(value ?? "").trim();
  const matched = raw.match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);
  return matched ? ymd(Number(matched[1]), Number(matched[2]), Number(matched[3])) : raw;
}

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

function isHtmlWorkbook(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const sample = Array.from(bytes.subarray(0, Math.min(bytes.length, 8_192)), (value) => String.fromCharCode(value))
    .join("")
    .replaceAll("\0", "")
    .toLocaleLowerCase("en");
  return sample.includes("<table") || sample.includes("<html") || sample.includes("<!doctype html");
}

/**
 * 일부 은행은 여러 HTML table을 .xls 확장자로 내려준다. Excel은 이를 한 화면에
 * 연속된 표처럼 보여주지만 SheetJS는 표마다 Sheet1, Sheet2로 나누므로, 이 형식만
 * 원래 화면 순서대로 이어 붙여 Excel에서 보이는 행 번호를 유지한다.
 */
export function workbookToSheets(
  XLSX: SheetJs,
  workbook: WorkBook,
  source: ArrayBuffer | Uint8Array,
): LedgerWorkbookSheet[] {
  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: worksheetToRows(XLSX, workbook.Sheets[name]),
  }));
  if (!isHtmlWorkbook(source) || sheets.length <= 1) return sheets;
  return [{ name: sheets[0]?.name ?? "Sheet1", rows: sheets.flatMap((sheet) => sheet.rows) }];
}
