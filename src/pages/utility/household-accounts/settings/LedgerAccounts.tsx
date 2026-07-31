import LedgerPlaceholder from "../LedgerPlaceholder";
import type { LedgerScreenProps } from "../types";

export default function LedgerAccounts(props: LedgerScreenProps) {
  return (
    <LedgerPlaceholder
      {...props}
      title="계정 관리"
      description="거래를 기록할 구성원별 계정을 관리합니다."
      actionLabel="계정 추가"
    />
  );
}
