import LedgerPlaceholder from "../LedgerPlaceholder";
import type { LedgerScreenProps } from "../types";

export default function LedgerOverview(props: LedgerScreenProps) {
  return (
    <LedgerPlaceholder
      {...props}
      title="월별 현황"
      description="월별 수입·지출과 개인·가족 현금흐름을 확인합니다."
      actionLabel="거래 가져오기"
    />
  );
}
