import LedgerPlaceholder from "../LedgerPlaceholder";
import type { LedgerScreenProps } from "../types";

export default function LedgerTransactions(props: LedgerScreenProps) {
  return (
    <LedgerPlaceholder
      {...props}
      title="거래내역"
      description="거래를 조회하고 직접 입력하거나 엑셀에서 가져옵니다."
      actionLabel="엑셀 가져오기"
    />
  );
}
