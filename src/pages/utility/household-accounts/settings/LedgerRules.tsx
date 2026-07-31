import LedgerPlaceholder from "../LedgerPlaceholder";
import type { LedgerScreenProps } from "../types";

export default function LedgerRules(props: LedgerScreenProps) {
  return (
    <LedgerPlaceholder
      {...props}
      title="자동분류 규칙"
      description="거래내용과 상대방을 기준으로 적용할 분류 규칙을 관리합니다."
      actionLabel="규칙 추가"
    />
  );
}
