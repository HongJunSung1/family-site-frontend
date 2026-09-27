import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { detectHeaderRow, excelDateText, workbookToSheets, worksheetToRows } from "./ledgerExcel";

describe("가계부 엑셀 행 변환", () => {
  it("축소된 XLS 사용 범위보다 아래에 있는 셀과 빈 행을 실제 행 번호대로 유지한다", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([["제목"], ["계좌 정보"]]);
    worksheet.A6 = { t: "s", v: "No" };
    worksheet.B6 = { t: "s", v: "거래일시" };
    worksheet["!ref"] = "A1:B2";

    const rows = worksheetToRows(XLSX, worksheet);

    expect(rows).toHaveLength(6);
    expect(rows[5]).toEqual(["No", "거래일시"]);
  });

  it("HTML 표가 여러 개인 XLS를 Excel에 보이는 순서대로 한 시트에 합친다", () => {
    const html = `<html><body>
      <table><tr><td>거래내역조회</td></tr></table>
      <table>
        <tr><td>계좌번호</td></tr><tr><td>예금주명</td></tr>
        <tr><td>현재잔액</td></tr><tr><td>조회시작일자</td></tr>
      </table>
      <table><tr><td>No</td><td>거래일시</td></tr><tr><td>1</td><td>2026-08-30</td></tr></table>
    </body></html>`;
    const source = new TextEncoder().encode(html);
    const workbook = XLSX.read(source, { type: "array" });

    const sheets = workbookToSheets(XLSX, workbook, source);

    expect(sheets).toHaveLength(1);
    expect(sheets[0].rows).toHaveLength(7);
    expect(sheets[0].rows[5]).toEqual(["No", "거래일시"]);
  });

  it("화면 행 번호가 달라도 IBK 거래 열 이름이 모인 실제 헤더를 찾는다", () => {
    const rows = [
      ["거래내역조회_입출식"],
      ["계좌번호", "230-0000"],
      ["No", "거래일시", "출금", "입금", "거래후 잔액", "거래내용", "상대은행", "거래구분"],
      [1, "2026-08-30 19:19:02", 500000, 0, 6125175, "홍준성", "케이뱅크", "API이체"],
    ];

    expect(detectHeaderRow(rows)).toBe(3);
  });

  it("XLS에서 Date 객체로 읽힌 거래일시를 유효한 거래일로 변환한다", () => {
    const value = new Date(2026, 7, 25, 13, 58, 4);

    expect(excelDateText(value, "AUTO")).toBe("2026-08-25");
    expect(excelDateText(value, "EXCEL_SERIAL")).toBe("2026-08-25");
    expect(excelDateText("2026-13-58 04:00", "AUTO")).toBe("");
  });
});
