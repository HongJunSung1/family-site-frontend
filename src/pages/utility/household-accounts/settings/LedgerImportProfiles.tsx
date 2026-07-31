import LedgerPlaceholder from "../LedgerPlaceholder";
import type { LedgerScreenProps } from "../types";

export default function LedgerImportProfiles(props: LedgerScreenProps) {
  return (
    <LedgerPlaceholder
      {...props}
      title="엑셀 가져오기 양식"
      description="은행별 엑셀 열과 거래 필드의 연결 규칙을 관리합니다."
      actionLabel="양식 추가"
    />
  );
}
