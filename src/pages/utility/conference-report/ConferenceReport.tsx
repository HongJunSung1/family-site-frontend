import type { AttendanceStatus, MeetingStatus, MeetingType } from "../../../api/meetingApi";
import { AlertDialog, ConfirmDialog } from "../../../common/dialog";
import { Input, TextareaInput } from "../../../common/input";
import { LoadingOverlay } from "../../../common/loading";
import { AgendaSection } from "./AgendaSection";
import { MeetingListPanel } from "./MeetingListPanel";
import {
  attendanceLabels, meetingStatusLabels, meetingTypeLabels, useMeetingReport,
} from "./useMeetingReport";
import reportStyles from "./ConferenceReport.module.css";

// 회의 목록과 상세 영역을 배치하고 공통 대화상자를 연결
export default function ConferenceReport() {
  const report = useMeetingReport();
  const {
    shouldShowMeetingForm,
    handleConfirmMeetingNavigation,
    handleSaveMeeting,
    handleDeleteMeeting,
    handleAttendanceChange,
    handleConfirmCancelAgenda,
    handleCloseAgendaCancel,
    handleDeleteAgenda,
    handleDeleteDiscussion,
    handleDeleteAction,
    handleDeleteComment,
    meetingTitleText,
    meetingSummaryText,
    canDeleteMeeting,
    meetingListPinnedOpen,
    meetingListHoverReady,
    isCreating,
    detail,
    loading,
    saving,
    deleteMeetingOpen,
    setDeleteMeetingOpen,
    deleteAgendaId,
    setDeleteAgendaId,
    deleteDiscussionId,
    setDeleteDiscussionId,
    deleteActionId,
    setDeleteActionId,
    deleteCommentId,
    setDeleteCommentId,
    alertMessage,
    alertOpen,
    setAlertOpen,
    pendingNavigation,
    setPendingNavigation,
    agendaCancelMode,
    meetingInfoOpen,
    setMeetingInfoOpen,
    form,
    setForm,
  } = report;

  return (
    <main className={reportStyles.page}>
      <div
        className={[
          reportStyles.layout,
          !meetingListPinnedOpen ? reportStyles.layoutListCollapsed : "",
          !meetingListHoverReady ? reportStyles.layoutListHoverSuppressed : "",
        ].filter(Boolean).join(" ")}
      >
        <MeetingListPanel report={report} />
        <section className={`${reportStyles.panel} ${reportStyles.detailPanel}`}>
          <header className={reportStyles.panelHeader}>
            <div className={reportStyles.meetingDetailHeader}>
              <div className={reportStyles.meetingTitleBlock}>
                <h2>{meetingTitleText}</h2>
                {detail && <span className={reportStyles.meetingSummaryLine}>{meetingSummaryText}</span>}
              </div>
              {(detail || isCreating) && (
                <div className={reportStyles.headerActions}>
                  {canDeleteMeeting && (
                    <button type="button" className={reportStyles.dangerButton} onClick={() => setDeleteMeetingOpen(true)}>
                      삭제
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          <div className={reportStyles.detailBody}>
            {!shouldShowMeetingForm && (
              <div className={reportStyles.empty}>회의 목록에서 회의를 선택하거나 새 회의를 눌러주세요.</div>
            )}

            {shouldShowMeetingForm && (
              <section className={reportStyles.section}>
                <div
                  className={[
                    reportStyles.sectionHeader,
                    detail ? reportStyles.sectionHeaderClickable : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (detail) setMeetingInfoOpen((prev) => !prev);
                  }}
                >
                  <div className={reportStyles.sectionTitleOnly}>
                    <h3>회의 정보</h3>
                  </div>
                  <div className={reportStyles.headerActions}>
                    {(isCreating || meetingInfoOpen) && (
                      <button
                        type="button"
                        className={reportStyles.primaryButton}
                        disabled={saving}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSaveMeeting();
                        }}
                      >
                        {detail ? "저장" : "생성"}
                      </button>
                    )}
                    {detail && (
                      <button
                        type="button"
                        className={reportStyles.ghostButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMeetingInfoOpen((prev) => !prev);
                        }}
                      >
                        {meetingInfoOpen ? "접기" : "자세히"}
                      </button>
                    )}
                  </div>
                </div>

                {(isCreating || meetingInfoOpen) && (
                  <div className={reportStyles.formGrid}>
                    <Input
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="회의명"
                    />
                    <div className={reportStyles.twoCols}>
                      <select
                        className={reportStyles.select}
                        value={form.meetingType}
                        onChange={(event) => setForm((prev) => ({ ...prev, meetingType: event.target.value as MeetingType }))}
                      >
                        {Object.entries(meetingTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        className={reportStyles.select}
                        value={form.status}
                        onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as MeetingStatus }))}
                      >
                        {Object.entries(meetingStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={reportStyles.twoCols}>
                      <Input
                        type="datetime-local"
                        value={form.meetingAt}
                        onChange={(event) => setForm((prev) => ({ ...prev, meetingAt: event.target.value }))}
                      />
                      <Input
                        value={form.location}
                        onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                        placeholder="장소"
                      />
                    </div>
                    <div className={reportStyles.meetingMemoParticipantsGrid}>
                      <div className={reportStyles.meetingInfoSubPane}>
                        <h4>회의 메모</h4>
                        <TextareaInput
                          value={form.memo}
                          height={118}
                          onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                          placeholder="회의 메모"
                        />
                      </div>
                      {detail && (
                        <div className={reportStyles.meetingInfoSubPane}>
                          <h4>참석자</h4>
                          <div className={reportStyles.participantList}>
                            {detail.participants.map((participant) => (
                              <div className={reportStyles.participantRow} key={participant.user_id}>
                                <strong>{participant.name || participant.email}</strong>
                                <div className={reportStyles.radioGroup}>
                                  {Object.entries(attendanceLabels).map(([value, label]) => (
                                    <label className={reportStyles.radioOption} key={value}>
                                      <input
                                        type="radio"
                                        name={`attendance-${participant.user_id}`}
                                        value={value}
                                        checked={participant.attendance_status === value}
                                        onChange={() => handleAttendanceChange(participant.user_id, value as AttendanceStatus)}
                                      />
                                      <span>{label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
            {detail && <AgendaSection report={report} />}
          </div>
        </section>
      </div>

      {loading && <LoadingOverlay label="회의록 로딩 중" />}
      <ConfirmDialog
        open={agendaCancelMode !== null}
        title="취소 확인"
        message={
          agendaCancelMode === "switch"
            ? "현재 안건 수정을 취소하고 다른 안건을 수정하시겠습니까?"
            : "취소하시겠습니까?"
        }
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={handleCloseAgendaCancel}
        onConfirm={handleConfirmCancelAgenda}
      />
      <ConfirmDialog
        open={pendingNavigation !== null}
        title="작성 내용 확인"
        message="다른 화면으로 이동하면 현재 작성 중인 내용이 사라집니다. 계속하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setPendingNavigation(null)}
        onConfirm={handleConfirmMeetingNavigation}
      />
      <ConfirmDialog
        open={deleteMeetingOpen}
        title="회의록 삭제"
        message="회의록을 삭제하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDeleteMeetingOpen(false)}
        onConfirm={handleDeleteMeeting}
      />
      <ConfirmDialog
        open={deleteAgendaId !== null}
        title="안건 삭제"
        message="안건을 삭제하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDeleteAgendaId(null)}
        onConfirm={handleDeleteAgenda}
      />
      <ConfirmDialog
        open={deleteDiscussionId !== null}
        title="논의/결정 삭제"
        message="논의/결정을 삭제하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDeleteDiscussionId(null)}
        onConfirm={handleDeleteDiscussion}
      />
      <ConfirmDialog
        open={deleteActionId !== null}
        title="할 일 삭제"
        message="할 일을 삭제하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDeleteActionId(null)}
        onConfirm={handleDeleteAction}
      />
      <ConfirmDialog
        open={deleteCommentId !== null}
        title="댓글 삭제"
        message="댓글을 삭제하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDeleteCommentId(null)}
        onConfirm={handleDeleteComment}
      />
      <AlertDialog
        open={alertOpen}
        title="안내"
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
    </main>
  );
}
