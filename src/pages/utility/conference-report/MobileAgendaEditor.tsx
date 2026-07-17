import type { ReactNode } from "react";
import reportStyles from "./ConferenceReport.module.css";

type MobileAgendaCreateShellProps = {
  children: ReactNode;
};

type MobileAgendaCardShellProps = {
  children: ReactNode;
  editing: boolean;
};

// 모바일에서 새 안건 입력 영역을 전체 화면으로 전환하는 외곽 셸
export function MobileAgendaCreateShell({ children }: MobileAgendaCreateShellProps) {
  return <div className={reportStyles.agendaAddBox}>{children}</div>;
}

// 모바일에서 수정 중인 안건 카드만 전체 화면으로 전환하는 외곽 셸
export function MobileAgendaCardShell({ children, editing }: MobileAgendaCardShellProps) {
  return (
    <article
      className={reportStyles.agendaCard}
      data-agenda-editing={editing ? "true" : "false"}
    >
      {children}
    </article>
  );
}
