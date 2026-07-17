import type { MeetingAgenda, MeetingDiscussion } from "../../../api/meetingApi";
import { TextareaInput } from "../../../common/input";
import { ActionItemSection } from "./ActionItemSection";
import type { MeetingReportController } from "./useMeetingReport";
import reportStyles from "./ConferenceReport.module.css";

type DiscussionDecisionSectionProps = {
  report: MeetingReportController;
  agenda?: MeetingAgenda;
  discussion?: MeetingDiscussion | null;
  mode: "create" | "edit" | "view";
};

// 안건의 논의 내용과 결정 사항 입력·조회 영역
export function DiscussionDecisionSection({
  report,
  agenda,
  discussion,
  mode,
}: DiscussionDecisionSectionProps) {
  const {
    detail,
    agendaDiscussion,
    setAgendaDiscussion,
    agendaDecision,
    setAgendaDecision,
    editingDiscussionDraft,
    setEditingDiscussionDraft,
  } = report;

  if (mode === "create") {
    return (
      <div className={reportStyles.discussionEditorFields}>
        <label>
          <span>논의 내용</span>
          <TextareaInput height={78} value={agendaDiscussion} onChange={(event) => setAgendaDiscussion(event.target.value)} placeholder="논의 내용을 입력해주세요." />
        </label>
        <label>
          <span>결정 사항</span>
          <TextareaInput height={78} value={agendaDecision} onChange={(event) => setAgendaDecision(event.target.value)} placeholder="결정 사항을 입력해주세요." />
        </label>
      </div>
    );
  }

  if (!agenda || !detail) return null;
  const actions = discussion
    ? detail.actionItems.filter(
        (action) =>
          action.discussion_id === discussion.id ||
          (action.agenda_id === agenda.id && action.discussion_id === null)
      )
    : [];

  if (mode === "edit" && editingDiscussionDraft) {
    return (
      <>
        <div className={reportStyles.discussionEditorFields}>
          <label>
            <span>논의 내용</span>
            <TextareaInput
              height={84}
              value={editingDiscussionDraft.discussion}
              onChange={(event) => setEditingDiscussionDraft({ ...editingDiscussionDraft, discussion: event.target.value })}
            />
          </label>
          <label>
            <span>결정 사항</span>
            <TextareaInput
              height={84}
              value={editingDiscussionDraft.decision}
              onChange={(event) => setEditingDiscussionDraft({ ...editingDiscussionDraft, decision: event.target.value })}
            />
          </label>
        </div>
        {discussion && <ActionItemSection report={report} discussionId={discussion.id} actions={actions} editable />}
      </>
    );
  }

  if (!discussion) return <p className={reportStyles.emptyText}>안건 내용이 없습니다.</p>;

  return (
    <>
      <div className={reportStyles.discussionPreviewGrid}>
        <div>
          <span className={reportStyles.previewLabel}>논의 내용</span>
          <p className={reportStyles.previewText}>{discussion.discussion.trim() || "-"}</p>
        </div>
        <div>
          <span className={reportStyles.previewLabel}>결정 사항</span>
          <p className={reportStyles.previewText}>{discussion.decision.trim() || "-"}</p>
        </div>
      </div>
      <ActionItemSection report={report} discussionId={discussion.id} actions={actions} />
    </>
  );
}
