import { AgendaEditor } from "./AgendaEditor";
import { NewActionItemSection } from "./ActionItemSection";
import { AttachmentSection } from "./AttachmentSection";
import { CommentSection } from "./CommentSection";
import { DiscussionDecisionSection } from "./DiscussionDecisionSection";
import {
  MobileAgendaCardShell,
  MobileAgendaCreateShell,
} from "./MobileAgendaEditor";
import {
  agendaPriorityLabels,
  agendaStatusLabels,
  type MeetingReportController,
} from "./useMeetingReport";
import reportStyles from "./ConferenceReport.module.css";

// 안건 목록을 구성하고 편집·논의·할 일·댓글 하위 영역 연결
export function AgendaSection({ report }: { report: MeetingReportController }) {
  const {
    agendaChildren,
    toggleAgendaOpen,
    handleStartEditAgenda,
    detail,
    setDeleteAgendaId,
    agendaAddOpen,
    setAgendaAddOpen,
    setAgendaCancelMode,
    editingAgendaId,
    editingAgendaDraft,
    openAgendaIds,
    editingDiscussionDraft,
  } = report;

  if (!detail) return null;

  return (
    <section className={`${reportStyles.section} ${reportStyles.agendaSection}`}>
      <div className={reportStyles.sectionHeader}>
        <h3>안건</h3>
        <div className={reportStyles.headerActions}>
          <span className={reportStyles.badge}>{detail.agendas.length}개</span>
        </div>
      </div>

      {agendaAddOpen && (
        <MobileAgendaCreateShell>
          <AgendaEditor report={report} />
          <DiscussionDecisionSection report={report} mode="create" />
          <NewActionItemSection report={report} />
        </MobileAgendaCreateShell>
      )}

      <div className={reportStyles.agendaList}>
        {detail.agendas.map((agenda) => {
          const isOpen = openAgendaIds.has(agenda.id);
          const discussions = agendaChildren.discussionsByAgenda.get(agenda.id) ?? [];
          const comments = agendaChildren.commentsByAgenda.get(agenda.id) ?? [];
          const primaryDiscussion = discussions[0] ?? null;
          const isEditing = editingAgendaId === agenda.id;
          const canEditAgenda = detail.participants.some(
            (participant) => participant.user_id === detail.currentUserId
          );
          const canDeleteAgenda =
            agenda.created_by == null
              ? detail.meeting.created_by === detail.currentUserId
              : agenda.created_by === detail.currentUserId;

          return (
            <MobileAgendaCardShell key={agenda.id} editing={isEditing}>
              <div className={reportStyles.agendaHeader}>
                {isEditing && editingAgendaDraft ? (
                  <AgendaEditor report={report} agenda={agenda} />
                ) : (
                  <>
                    <button
                      type="button"
                      className={reportStyles.agendaToggle}
                      onClick={() => toggleAgendaOpen(agenda.id)}
                    >
                      <span className={reportStyles.agendaTitleText}>{agenda.title}</span>
                    </button>
                    <div className={reportStyles.agendaControls}>
                      <span className={reportStyles.agendaMetaText}>
                        중요도 : {agendaPriorityLabels[agenda.priority]}, 상태 : {agendaStatusLabels[agenda.status]}
                      </span>
                      {canEditAgenda && (
                        <button
                          type="button"
                          className={`${reportStyles.ghostButton} ${reportStyles.agendaEditButton}`}
                          onClick={() => handleStartEditAgenda(agenda)}
                        >
                          수정
                        </button>
                      )}
                      {canDeleteAgenda && (
                        <button
                          type="button"
                          className={`${reportStyles.dangerButton} ${reportStyles.agendaDeleteButton}`}
                          onClick={() => setDeleteAgendaId(agenda.id)}
                        >
                          삭제
                        </button>
                      )}
                      {!canDeleteAgenda && (
                        <span className={reportStyles.agendaDeletePlaceholder} aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        className={`${reportStyles.ghostButton} ${reportStyles.agendaExpandButton}`}
                        onClick={() => toggleAgendaOpen(agenda.id)}
                      >
                        <span className={`${reportStyles.chevron} ${isOpen ? reportStyles.chevronOpen : ""}`}>›</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {isOpen && (
                <div className={reportStyles.agendaDetail}>
                  <section className={reportStyles.agendaDocument}>
                    <DiscussionDecisionSection
                      report={report}
                      agenda={agenda}
                      discussion={primaryDiscussion}
                      mode={isEditing && editingDiscussionDraft ? "edit" : "view"}
                    />
                    {!isEditing && (
                      <>
                        {canEditAgenda && (
                          <AttachmentSection
                            report={report}
                            agendaId={agenda.id}
                            initialCount={Number(agenda.attachment_count ?? 0)}
                          />
                        )}
                        <CommentSection report={report} agendaId={agenda.id} comments={comments} />
                      </>
                    )}
                  </section>
                </div>
              )}
            </MobileAgendaCardShell>
          );
        })}
      </div>

      <div className={reportStyles.agendaAddFooter}>
        <button
          type="button"
          className={reportStyles.ghostButton}
          onClick={() => {
            if (agendaAddOpen) setAgendaCancelMode("add");
            else setAgendaAddOpen(true);
          }}
        >
          {agendaAddOpen ? "안건 추가 닫기" : "+ 안건 추가"}
        </button>
      </div>
    </section>
  );
}
