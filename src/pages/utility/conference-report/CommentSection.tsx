import { useLayoutEffect, useRef, useState } from "react";
import type { MeetingComment } from "../../../api/meetingApi";
import { Input } from "../../../common/input";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_PAGE_SIZE,
  formatDateTime,
  type MeetingReportController,
} from "./useMeetingReport";
import reportStyles from "./ConferenceReport.module.css";

type CommentSectionProps = {
  report: MeetingReportController;
  agendaId: number;
  comments: MeetingComment[];
};

type ExpandableCommentTextProps = {
  content: string;
};

// 댓글이 표시 영역을 넘을 때만 전체 내용 펼침 기능 제공
function ExpandableCommentText({ content }: ExpandableCommentTextProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;

    const measureOverflow = () => {
      setCanExpand(element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
    };

    measureOverflow();
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content, expanded]);

  return (
    <div className={reportStyles.commentContent}>
      <p
        ref={textRef}
        className={`${reportStyles.commentText} ${expanded ? reportStyles.commentTextExpanded : ""}`}
      >
        {content}
      </p>
      {canExpand && (
        <button
          type="button"
          className={`${reportStyles.commentExpandButton} ${expanded ? reportStyles.commentExpandButtonOpen : ""}`}
          aria-label={expanded ? "댓글 접기" : "댓글 전체 보기"}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}


// 안건별 댓글 작성·수정·삭제와 페이지 이동 관리
export function CommentSection({ report, agendaId, comments }: CommentSectionProps) {
  const {
    toggleCommentInput,
    toggleCommentList,
    handleSaveComment,
    setCommentPage,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveEditedComment,
    detail,
    setDeleteCommentId,
    commentDrafts,
    setCommentDrafts,
    commentOpenAgendaIds,
    commentListOpenAgendaIds,
    commentPages,
    editingCommentId,
    editingCommentDraft,
    setEditingCommentDraft,
  } = report;
    const inputOpen = commentOpenAgendaIds.has(agendaId);
    const listOpen = commentListOpenAgendaIds.has(agendaId);
    const draft = commentDrafts[agendaId] ?? "";
    const totalPages = Math.max(1, Math.ceil(comments.length / COMMENT_PAGE_SIZE));
    const currentPage = Math.min(commentPages[agendaId] ?? 1, totalPages);
    const pageStart = (currentPage - 1) * COMMENT_PAGE_SIZE;
    const visibleComments = comments.slice(pageStart, pageStart + COMMENT_PAGE_SIZE);

    return (
      <div className={reportStyles.commentPanel}>
        <div className={reportStyles.commentPanelTitle} onClick={() => toggleCommentList(agendaId)}>
          <div className={reportStyles.commentTitleGroup}>
            <strong>댓글</strong>
            <span className={reportStyles.commentCount}>{comments.length}</span>
          </div>
          {detail?.canEdit && (
            <button
              type="button"
              className={reportStyles.inlineAddButton}
              onClick={(event) => {
                event.stopPropagation();
                toggleCommentInput(agendaId);
              }}
            >
              +댓글 작성
            </button>
          )}
          <span className={`${reportStyles.chevron} ${reportStyles.commentHeaderChevron} ${listOpen ? reportStyles.chevronOpen : ""}`}>›</span>
        </div>

        {inputOpen && (
          <div className={reportStyles.commentEditor}>
            <Input
              value={draft}
              maxLength={COMMENT_MAX_LENGTH}
              onChange={(event) =>
                setCommentDrafts((prev) => ({ ...prev, [agendaId]: event.target.value.slice(0, COMMENT_MAX_LENGTH) }))
              }
              placeholder="댓글을 입력해주세요. (100자 이내)"
            />
            <div className={reportStyles.commentEditorActions}>
              <span className={reportStyles.commentLength}>{draft.length}/{COMMENT_MAX_LENGTH}</span>
              <button type="button" className={reportStyles.primaryButton} onClick={() => handleSaveComment(agendaId)}>
                저장
              </button>
              <button type="button" className={reportStyles.ghostButton} onClick={() => toggleCommentInput(agendaId)}>
                취소
              </button>
            </div>
          </div>
        )}

        {listOpen && (
          <div className={reportStyles.commentList}>
            {visibleComments.map((comment) => {
              const isEdited = comment.updated_at.slice(0, 16) !== comment.created_at.slice(0, 16);
              const canManageComment = comment.created_by === detail?.currentUserId;
              return (
                <div
                  className={`${reportStyles.commentItem} ${isEdited ? reportStyles.commentItemEdited : ""}`}
                  key={comment.id}
                >
                  <div className={reportStyles.commentMeta}>
                    <strong>{comment.author_name || comment.author_email}</strong>
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className={reportStyles.commentEditor}>
                      <Input
                        value={editingCommentDraft}
                        maxLength={COMMENT_MAX_LENGTH}
                        onChange={(event) => setEditingCommentDraft(event.target.value.slice(0, COMMENT_MAX_LENGTH))}
                      />
                      <div className={reportStyles.commentEditorActions}>
                        <span className={reportStyles.commentLength}>{editingCommentDraft.length}/{COMMENT_MAX_LENGTH}</span>
                        <button type="button" className={reportStyles.primaryButton} onClick={() => handleSaveEditedComment(comment.id)}>
                          저장
                        </button>
                        <button type="button" className={reportStyles.ghostButton} onClick={handleCancelEditComment}>
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ExpandableCommentText content={comment.content} />
                  )}
                  <span className={reportStyles.commentDate}>
                    {formatDateTime(comment.created_at.slice(0, 16))}
                    {isEdited && <em>수정됨</em>}
                  </span>
                  <div className={reportStyles.commentActions}>
                    {canManageComment && editingCommentId !== comment.id && (
                      <>
                        <button type="button" className={reportStyles.ghostButton} onClick={() => handleStartEditComment(comment)}>
                          수정
                        </button>
                        <button type="button" className={reportStyles.dangerButton} onClick={() => setDeleteCommentId(comment.id)}>
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {comments.length === 0 && <p className={reportStyles.commentEmpty}>등록된 댓글이 없습니다.</p>}
            {comments.length > COMMENT_PAGE_SIZE && (
              <div className={reportStyles.commentPagination} aria-label="댓글 페이지">
                <button
                  type="button"
                  className={`${reportStyles.commentPageButton} ${reportStyles.commentPageArrow}`}
                  aria-label="이전 댓글 페이지"
                  disabled={currentPage <= 1}
                  onClick={() => setCommentPage(agendaId, currentPage - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    type="button"
                    className={`${reportStyles.commentPageButton} ${page === currentPage ? reportStyles.commentPageButtonActive : ""}`}
                    aria-label={`${page}페이지`}
                    aria-current={page === currentPage ? "page" : undefined}
                    onClick={() => setCommentPage(agendaId, page)}
                    key={page}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${reportStyles.commentPageButton} ${reportStyles.commentPageArrow}`}
                  aria-label="다음 댓글 페이지"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCommentPage(agendaId, currentPage + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
}
