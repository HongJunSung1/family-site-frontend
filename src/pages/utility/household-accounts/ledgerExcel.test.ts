import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { worksheetToRows } from "./ledgerExcel";

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
});
