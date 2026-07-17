import { useState } from "react";
import {
  createMeetingComment,
  deleteMeetingComment,
  updateMeetingComment,
  type MeetingComment,
} from "../../../api/meetingApi";
import { COMMENT_MAX_LENGTH } from "./meetingReportModel";

type UseMeetingCommentsOptions = {
  reloadDetail: () => Promise<void>;
};

// 안건 댓글의 입력·목록·수정·삭제와 페이징 상태 관리
export function useMeetingComments({ reloadDetail }: UseMeetingCommentsOptions) {
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [commentOpenAgendaIds, setCommentOpenAgendaIds] = useState<Set<number>>(new Set());
  const [commentListOpenAgendaIds, setCommentListOpenAgendaIds] = useState<Set<number>>(new Set());
  const [commentPages, setCommentPages] = useState<Record<number, number>>({});
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);

  // 댓글 입력창 열기·닫기
  const toggleCommentInput = (agendaId: number) => {
    setCommentOpenAgendaIds((prev) => {
      const next = new Set(prev);
      if (next.has(agendaId)) next.delete(agendaId);
      else next.add(agendaId);
      return next;
    });
  };

  // 댓글 목록 열기·닫기
  const toggleCommentList = (agendaId: number) => {
    setCommentListOpenAgendaIds((prev) => {
      const next = new Set(prev);
      if (next.has(agendaId)) next.delete(agendaId);
      else next.add(agendaId);
      return next;
    });
  };

  // 새 댓글 저장
  const handleSaveComment = async (agendaId: number) => {
    const content = (commentDrafts[agendaId] ?? "").trim().slice(0, COMMENT_MAX_LENGTH);
    if (!content) return;
    await createMeetingComment(agendaId, { content });
    setCommentDrafts((prev) => ({ ...prev, [agendaId]: "" }));
    setCommentOpenAgendaIds((prev) => {
      const next = new Set(prev);
      next.delete(agendaId);
      return next;
    });
    setCommentListOpenAgendaIds((prev) => new Set(prev).add(agendaId));
    setCommentPages((prev) => ({ ...prev, [agendaId]: 1 }));
    await reloadDetail();
  };

  // 댓글 페이지 변경
  const setCommentPage = (agendaId: number, page: number) => {
    setCommentPages((prev) => ({ ...prev, [agendaId]: page }));
  };

  // 댓글 수정 시작
  const handleStartEditComment = (comment: MeetingComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentDraft(comment.content);
  };

  // 댓글 수정 취소
  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentDraft("");
  };

  // 수정한 댓글 저장
  const handleSaveEditedComment = async (commentId: number) => {
    const content = editingCommentDraft.trim().slice(0, COMMENT_MAX_LENGTH);
    if (!content) return;
    await updateMeetingComment(commentId, { content });
    handleCancelEditComment();
    await reloadDetail();
  };

  // 댓글 삭제
  const handleDeleteComment = async () => {
    if (!deleteCommentId) return;
    await deleteMeetingComment(deleteCommentId);
    if (editingCommentId === deleteCommentId) handleCancelEditComment();
    setDeleteCommentId(null);
    await reloadDetail();
  };

  return {
    commentDrafts,
    setCommentDrafts,
    commentOpenAgendaIds,
    setCommentOpenAgendaIds,
    commentListOpenAgendaIds,
    setCommentListOpenAgendaIds,
    commentPages,
    setCommentPages,
    editingCommentId,
    setEditingCommentId,
    editingCommentDraft,
    setEditingCommentDraft,
    deleteCommentId,
    setDeleteCommentId,
    toggleCommentInput,
    toggleCommentList,
    handleSaveComment,
    setCommentPage,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveEditedComment,
    handleDeleteComment,
  };
}
