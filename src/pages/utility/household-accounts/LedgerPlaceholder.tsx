import type { LedgerScreenProps } from "./types";
import styles from "./HouseholdAccounts.module.css";

type LedgerPlaceholderProps = LedgerScreenProps & {
  title: string;
  description: string;
  actionLabel?: string;
};

// 후속 개발 단계 전까지 각 가계부 화면의 역할과 빈 상태 표시
export default function LedgerPlaceholder({
  calendarId,
  calendarName,
  calendarControl,
  title,
  description,
  actionLabel,
}: LedgerPlaceholderProps) {
  return (
    <section className={styles.screen}>
      <header className={styles.screenHeader}>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {calendarControl}
      </header>

      <div className={styles.placeholder}>
        <strong>
          {calendarId
            ? `${calendarName}의 ${title} 화면입니다.`
            : "먼저 사용할 수 있는 캘린더가 필요합니다."}
        </strong>
        <span>
          {calendarId
            ? "현재 단계에서는 화면 구조만 연결했습니다."
            : "캘린더를 만들거나 초대받은 뒤 다시 확인해주세요."}
        </span>
        {calendarId && actionLabel && (
          <button type="button" disabled title="후속 개발 단계에서 사용할 수 있습니다.">
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}
