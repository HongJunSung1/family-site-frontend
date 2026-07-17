import type { AgendaPriority, AgendaStatus, MeetingAgenda } from "../../../api/meetingApi";
import { Input } from "../../../common/input";
import {
  agendaPriorityLabels,
  agendaStatusLabels,
  type MeetingReportController,
} from "./useMeetingReport";
import reportStyles from "./ConferenceReport.module.css";

type AgendaEditorProps = {
  report: MeetingReportController;
  agenda?: MeetingAgenda;
};

// 새 안건 또는 기존 안건의 제목·중요도·상태 입력 영역
export function AgendaEditor({ report, agenda }: AgendaEditorProps) {
  const {
    handleAddAgenda,
    handleSaveAgenda,
    setAgendaCancelMode,
    agendaTitle,
    setAgendaTitle,
    agendaPriority,
    setAgendaPriority,
    agendaStatus,
    setAgendaStatus,
    editingAgendaDraft,
    setEditingAgendaDraft,
  } = report;

  if (agenda) {
    if (!editingAgendaDraft) return null;

    return (
      <>
        <div className={reportStyles.agendaEditRow}>
          <label className={reportStyles.mobileAgendaField}>
            <span>안건 제목</span>
            <Input
              value={editingAgendaDraft.title}
              onChange={(event) =>
                setEditingAgendaDraft({ ...editingAgendaDraft, title: event.target.value })
              }
              placeholder="안건"
            />
          </label>
          <label className={reportStyles.mobileAgendaField}>
            <span>중요도</span>
            <select
              className={reportStyles.select}
              value={editingAgendaDraft.priority}
              onChange={(event) =>
                setEditingAgendaDraft({
                  ...editingAgendaDraft,
                  priority: event.target.value as AgendaPriority,
                })
              }
            >
              {Object.entries(agendaPriorityLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={reportStyles.mobileAgendaField}>
            <span>상태</span>
            <select
              className={reportStyles.select}
              value={editingAgendaDraft.status}
              onChange={(event) =>
                setEditingAgendaDraft({
                  ...editingAgendaDraft,
                  status: event.target.value as AgendaStatus,
                })
              }
            >
              {Object.entries(agendaStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className={reportStyles.agendaControls}>
          <button type="button" className={reportStyles.primaryButton} onClick={() => handleSaveAgenda(agenda)}>
            저장
          </button>
          <button type="button" className={reportStyles.ghostButton} onClick={() => setAgendaCancelMode("edit")}>
            취소
          </button>
        </div>
      </>
    );
  }

  return (
    <div className={reportStyles.agendaAddHeader}>
      <label className={reportStyles.mobileAgendaField}>
        <span>안건 제목</span>
        <Input value={agendaTitle} onChange={(event) => setAgendaTitle(event.target.value)} placeholder="안건 제목" />
      </label>
      <label className={reportStyles.mobileAgendaField}>
        <span>중요도</span>
        <select
          className={reportStyles.select}
          value={agendaPriority}
          onChange={(event) => setAgendaPriority(event.target.value as AgendaPriority)}
        >
          {Object.entries(agendaPriorityLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className={reportStyles.mobileAgendaField}>
        <span>상태</span>
        <select
          className={reportStyles.select}
          value={agendaStatus}
          onChange={(event) => setAgendaStatus(event.target.value as AgendaStatus)}
        >
          {Object.entries(agendaStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <div className={reportStyles.agendaAddActions}>
        <button type="button" className={reportStyles.secondaryButton} onClick={handleAddAgenda}>안건 저장</button>
        <button type="button" className={reportStyles.ghostButton} onClick={() => setAgendaCancelMode("add")}>취소</button>
      </div>
    </div>
  );
}
