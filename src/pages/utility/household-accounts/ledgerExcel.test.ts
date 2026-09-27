import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { workbookToSheets, worksheetToRows } from "./ledgerExcel";

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
});
