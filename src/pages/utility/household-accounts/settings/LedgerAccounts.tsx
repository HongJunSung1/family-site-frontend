import AssetAccountManagement from "../../asset-management/accounts/AssetAccountManagement";
import type { LedgerScreenProps } from "../types";

export default function LedgerAccounts(props: LedgerScreenProps) {
  return (
    <AssetAccountManagement
      {...props}
      title="계정 관리"
      description={`${props.calendarName}의 가계부와 자산관리에서 함께 사용하는 계정을 관리합니다.`}
      usageContext="ledger"
    />
  );
}
