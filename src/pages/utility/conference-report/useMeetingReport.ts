import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCalendarDetail, getMyCalendars, type MyCalendar } from "../../../api/calendarApi";
import {
  createMeeting, createMeetingActionItem, createMeetingAgenda,
  createMeetingDiscussion, deleteMeeting, deleteMeetingActionItem, deleteMeetingAgenda,
  deleteMeetingDiscussion, getMeetingDetail, getMeetings,
  saveMeetingParticipants, syncMeetingActionItemToCalendar, updateMeetingAgenda,
  updateMeetingActionItem, updateMeetingDiscussion, updateMeeting,
  type ActionStatus, type AgendaPriority, type AgendaStatus, type AttendanceStatus,
  type MeetingActionItem, type MeetingAgenda, type MeetingComment, type MeetingDiscussion,
  type MeetingListItem,
} from "../../../api/meetingApi";
import { useMobileHeader } from "../../../common/mobile-header";
import { useFavoriteColors } from "../calendar/hooks/useFavoriteColors";
import {
  getActionCalendarColor,
  getDefaultMeetingAt,
  getMeetingErrorMessage,
  formatDateTime,
  hasActionDraftValue,
  meetingStatusLabels,
  meetingTypeLabels,
  notifyCalendarEventsChanged,
  type ActionDraft,
  type DetailState,
  type MeetingForm,
  type MemberOption,
  type PendingMeetingNavigation,
} from "./meetingReportModel";
import { useMeetingComments } from "./useMeetingComments";

export * from "./meetingReportModel";

// 회의록의 조회·작성 상태와 서버 변경 작업을 한곳에서 관리
export function useMeetingReport() {
  const { setConfig, resetConfig } = useMobileHeader();
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<MyCalendar[]>([]);
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [meetingListPinnedOpen, setMeetingListPinnedOpen] = useState(true);
  const [meetingListHoverReady, setMeetingListHoverReady] = useState(true);
  const [mobileMeetingListOpen, setMobileMeetingListOpen] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteMeetingOpen, setDeleteMeetingOpen] = useState(false);
  const [deleteAgendaId, setDeleteAgendaId] = useState<number | null>(null);
  const [deleteDiscussionId, setDeleteDiscussionId] = useState<number | null>(null);
  const [deleteActionId, setDeleteActionId] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [meetingFormBaseline, setMeetingFormBaseline] = useState<MeetingForm | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingMeetingNavigation | null>(null);
  const { favoriteColors } = useFavoriteColors({
    onAlert: (message) => {
      setAlertMessage(message);
      setAlertOpen(true);
    },
  });
  const [actionColorDrafts, setActionColorDrafts] = useState<Record<number, string>>({});
  const [agendaTitle, setAgendaTitle] = useState("");
  const [agendaPriority, setAgendaPriority] = useState<AgendaPriority>("normal");
  const [agendaStatus, setAgendaStatus] = useState<AgendaStatus>("waiting");
  const [agendaDiscussion, setAgendaDiscussion] = useState("");
  const [agendaDecision, setAgendaDecision] = useState("");
  const [agendaActionDrafts, setAgendaActionDrafts] = useState<ActionDraft[]>([
    { content: "", managerId: null, dueStartDate: "", dueEndDate: "", status: "todo", calendarColor: "#56c7a5" },
  ]);
  const [agendaAddOpen, setAgendaAddOpen] = useState(false);
  const [agendaCancelMode, setAgendaCancelMode] = useState<"add" | "edit" | "switch" | null>(null);
  const [pendingAgendaEditId, setPendingAgendaEditId] = useState<number | null>(null);
  const [editingAgendaId, setEditingAgendaId] = useState<number | null>(null);
  const [editingAgendaDraft, setEditingAgendaDraft] = useState<{
    title: string;
    managerId: number | null;
    priority: AgendaPriority;
    status: AgendaStatus;
  } | null>(null);
  const [openAgendaIds, setOpenAgendaIds] = useState<Set<number>>(new Set());
  const [meetingInfoOpen, setMeetingInfoOpen] = useState(true);
  const [editingDiscussionId, setEditingDiscussionId] = useState<number | null>(null);
  const [editingDiscussionDraft, setEditingDiscussionDraft] = useState<{ discussion: string; decision: string } | null>(null);
  const [actionDraftRows, setActionDraftRows] = useState<Record<number, ActionDraft[]>>({});
  const [actionListOpenDiscussionIds, setActionListOpenDiscussionIds] = useState<Set<number>>(new Set());
  const [editingAgendaActionDrafts, setEditingAgendaActionDrafts] = useState<Record<number, ActionDraft & { status: ActionStatus }>>({});
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [editingActionDraft, setEditingActionDraft] = useState<{
    content: string;
    managerId: number | null;
    dueStartDate: string;
    dueEndDate: string;
    status: ActionStatus;
    calendarColor: string;
  } | null>(null);
  const [form, setForm] = useState<MeetingForm>({
    calendarId: 0,
    title: "",
    meetingType: "regular",
    meetingAt: getDefaultMeetingAt(),
    location: "",
    memo: "",
    status: "in_progress",
  });
  const comments = useMeetingComments({ reloadDetail });
  const {
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
  } = comments;

  const shouldShowMeetingForm = !!detail || isCreating;
  const meetingFormChanged = meetingFormBaseline !== null && JSON.stringify(form) !== JSON.stringify(meetingFormBaseline);
  const agendaAddChanged =
    agendaAddOpen &&
    (!!agendaTitle.trim() ||
      agendaPriority !== "normal" ||
      agendaStatus !== "waiting" ||
      !!agendaDiscussion.trim() ||
      !!agendaDecision.trim() ||
      agendaActionDrafts.some(hasActionDraftValue));
  const hasUnsavedChanges =
    meetingFormChanged ||
    agendaAddChanged ||
    editingAgendaId !== null ||
    editingDiscussionId !== null ||
    editingActionId !== null ||
    editingCommentId !== null ||
    Object.values(actionDraftRows).some((drafts) => drafts.some(hasActionDraftValue)) ||
    Object.values(commentDrafts).some((draft) => !!draft.trim());

  // API 실패 안내창 표시
  const showRequestError = (error: unknown, fallback = "요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.") => {
    setAlertMessage(getMeetingErrorMessage(error, fallback));
    setAlertOpen(true);
  };

  // 모바일 상단 제목 설정
  useEffect(() => {
    setConfig({ title: "회의록" });
    return resetConfig;
  }, [resetConfig, setConfig]);

  // 모바일 안건 편집 전체화면 표시 중 배경 스크롤 잠금
  useEffect(() => {
    const shouldLock = agendaAddOpen || editingAgendaId !== null;
    document.body.classList.toggle("meeting-agenda-editor-open", shouldLock);
    document.documentElement.classList.toggle("meeting-agenda-editor-open", shouldLock);
    return () => {
      document.body.classList.remove("meeting-agenda-editor-open");
      document.documentElement.classList.remove("meeting-agenda-editor-open");
    };
  }, [agendaAddOpen, editingAgendaId]);

  // 처리되지 않은 회의록 API 오류를 공통 안내창으로 표시
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setAlertMessage(getMeetingErrorMessage(event.reason, "요청 처리 중 오류가 발생했습니다. 다시 시도해주세요."));
      setAlertOpen(true);
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  // 작성 중 새로고침이나 외부 이동으로 입력값이 사라지는 상황 방지
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 상단·하단 내비게이션 이동도 작성 내용 폐기 확인 대상으로 처리
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (nextPath === currentPath) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({ type: "route", path: nextPath });
    };
    document.addEventListener("click", handleNavigationClick, true);
    return () => document.removeEventListener("click", handleNavigationClick, true);
  }, [hasUnsavedChanges]);

  // 최초 회의 목록 조회
  useEffect(() => {
    let alive = true;
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const myCalendars = await getMyCalendars();
        if (!alive) return;
        setCalendars(myCalendars);
        const firstCalendarId = myCalendars[0]?.calendarId ?? 0;
        setForm((prev) => ({ ...prev, calendarId: firstCalendarId }));
        const meetingRows = await getMeetings(firstCalendarId ? { calendarId: firstCalendarId } : {});
        if (!alive) return;
        setMeetings(meetingRows);
      } catch (error) {
        if (alive) showRequestError(error, "회의 목록을 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadInitialData();
    return () => {
      alive = false;
    };
  }, []);

  // 선택 회의 상세 조회
  useEffect(() => {
    if (!selectedMeetingId) {
      setDetail(null);
      return;
    }
    let alive = true;
    const loadDetail = async () => {
      setLoading(true);
      try {
        const data = await getMeetingDetail(selectedMeetingId);
        if (!alive) return;
        setDetail(data);
        setMeetingInfoOpen(false);
        setOpenAgendaIds(new Set());
        setActionDraftRows({});
        setActionListOpenDiscussionIds(new Set());
        setCommentDrafts({});
        setCommentOpenAgendaIds(new Set());
        setCommentListOpenAgendaIds(new Set());
        setCommentPages({});
        setEditingCommentId(null);
        setEditingCommentDraft("");
        setActionColorDrafts({});
        setAgendaAddOpen(false);
        setEditingAgendaId(null);
        setEditingAgendaDraft(null);
        setEditingDiscussionId(null);
        setEditingDiscussionDraft(null);
        setEditingActionId(null);
        setEditingActionDraft(null);
        const nextForm: MeetingForm = {
          calendarId: data.meeting.calendar_id,
          title: data.meeting.title,
          meetingType: data.meeting.meeting_type,
          meetingAt: data.meeting.meeting_at,
          location: data.meeting.location,
          memo: data.meeting.memo,
          status: data.meeting.status,
        };
        setForm(nextForm);
        setMeetingFormBaseline(nextForm);
      } catch (error) {
        if (alive) {
          setDetail(null);
          showRequestError(error, "회의 상세 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      alive = false;
    };
  }, [
    selectedMeetingId,
    setCommentDrafts,
    setCommentListOpenAgendaIds,
    setCommentOpenAgendaIds,
    setCommentPages,
    setEditingCommentDraft,
    setEditingCommentId,
  ]);

  // 캘린더 멤버 목록 조회
  useEffect(() => {
    if (!form.calendarId) {
      setMembers([]);
      return;
    }
    let alive = true;
    const loadMembers = async () => {
      try {
        const data = await getCalendarDetail(form.calendarId);
        if (!alive) return;
        setMembers(data.members.map((member) => ({ id: member.user_id, name: member.name || member.email })));
      } catch {
        if (alive) setMembers([]);
      }
    };
    loadMembers();
    return () => {
      alive = false;
    };
  }, [form.calendarId]);

  // 안건별 하위 데이터 분류
  const agendaChildren = useMemo(() => {
    const discussionsByAgenda = new Map<number, MeetingDiscussion[]>();
    const actionsByAgenda = new Map<number, MeetingActionItem[]>();
    const commentsByAgenda = new Map<number, MeetingComment[]>();
    for (const discussion of detail?.discussions ?? []) {
      const list = discussionsByAgenda.get(discussion.agenda_id) ?? [];
      list.push(discussion);
      discussionsByAgenda.set(discussion.agenda_id, list);
    }
    for (const action of detail?.actionItems ?? []) {
      const list = actionsByAgenda.get(action.agenda_id) ?? [];
      list.push(action);
      actionsByAgenda.set(action.agenda_id, list);
    }
    for (const comment of detail?.comments ?? []) {
      const list = commentsByAgenda.get(comment.agenda_id) ?? [];
      list.push(comment);
      commentsByAgenda.set(comment.agenda_id, list);
    }
    for (const list of commentsByAgenda.values()) {
      list.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
    }
    return { discussionsByAgenda, actionsByAgenda, commentsByAgenda };
  }, [detail]);

  // 회의 목록 재조회
  const reloadMeetings = async (calendarId = form.calendarId) => {
    const rows = await getMeetings({ calendarId: calendarId || undefined, keyword });
    setMeetings(rows);
    return rows;
  };

  // 회의 상세 재조회
  async function reloadDetail() {
    if (!selectedMeetingId) return;
    const data = await getMeetingDetail(selectedMeetingId);
    setDetail(data);
    setActionColorDrafts({});
  }

  // 새 회의 작성 화면 초기화
  const startNewMeeting = () => {
    const nextForm: MeetingForm = {
      calendarId: form.calendarId || calendars[0]?.calendarId || 0,
      title: "",
      meetingType: "regular",
      meetingAt: getDefaultMeetingAt(),
      location: "",
      memo: "",
      status: "in_progress",
    };
    setSelectedMeetingId(null);
    setIsCreating(true);
    setMobileMeetingListOpen(false);
    setDetail(null);
    setMeetingInfoOpen(true);
    setOpenAgendaIds(new Set());
    setActionDraftRows({});
    setActionListOpenDiscussionIds(new Set());
    setCommentDrafts({});
    setCommentOpenAgendaIds(new Set());
    setCommentListOpenAgendaIds(new Set());
    setCommentPages({});
    setEditingCommentId(null);
    setEditingCommentDraft("");
    setActionColorDrafts({});
    setAgendaAddOpen(false);
    setEditingAgendaId(null);
    setEditingAgendaDraft(null);
    setEditingDiscussionId(null);
    setEditingDiscussionDraft(null);
    setForm(nextForm);
    setMeetingFormBaseline(nextForm);
  };

  // 회의 선택 화면으로 이동
  const selectMeeting = (meetingId: number) => {
    setIsCreating(false);
    setSelectedMeetingId(meetingId);
    setMobileMeetingListOpen(false);
  };

  // 캘린더 변경 후 회의 목록 초기화
  const changeMeetingCalendar = async (calendarId: number) => {
    setForm((prev) => ({ ...prev, calendarId }));
    setMeetingFormBaseline(null);
    await reloadMeetings(calendarId);
    setIsCreating(false);
    setSelectedMeetingId(null);
    setDetail(null);
  };

  // 작성 중이면 이동 전에 입력 내용 폐기 확인
  const requestMeetingNavigation = (navigation: PendingMeetingNavigation) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(navigation);
      return;
    }
    if (navigation.type === "new") startNewMeeting();
    if (navigation.type === "meeting") selectMeeting(navigation.meetingId);
    if (navigation.type === "calendar") void changeMeetingCalendar(navigation.calendarId);
    if (navigation.type === "route") navigate(navigation.path);
  };

  // 입력 내용 폐기 확인 후 요청한 화면으로 이동
  const handleConfirmMeetingNavigation = () => {
    const navigation = pendingNavigation;
    setPendingNavigation(null);
    if (!navigation) return;
    if (navigation.type === "new") startNewMeeting();
    if (navigation.type === "meeting") selectMeeting(navigation.meetingId);
    if (navigation.type === "calendar") void changeMeetingCalendar(navigation.calendarId);
    if (navigation.type === "route") navigate(navigation.path);
  };

  // 회의 생성/수정 저장
  const handleSaveMeeting = async () => {
    if (!form.calendarId || !form.title.trim()) return;
    setSaving(true);
    try {
      if (detail) {
        await updateMeeting(detail.meeting.id, form);
        setMeetingFormBaseline({ ...form });
        await reloadDetail();
        await reloadMeetings();
        notifyCalendarEventsChanged();
        setAlertMessage("저장되었습니다.");
        setAlertOpen(true);
        return;
      }
      const result = await createMeeting({ ...form, participantIds: members.map((member) => member.id) });
      const rows = await reloadMeetings(form.calendarId);
      setIsCreating(false);
      setMeetingFormBaseline(null);
      setSelectedMeetingId(result.meetingId ?? rows[0]?.id ?? null);
      notifyCalendarEventsChanged();
      setAlertMessage("저장되었습니다.");
      setAlertOpen(true);
    } catch (error) {
      showRequestError(error, "회의 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 회의 삭제
  const handleDeleteMeeting = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await deleteMeeting(detail.meeting.id);
      await reloadMeetings();
      setSelectedMeetingId(null);
      setMeetingFormBaseline(null);
      setDeleteMeetingOpen(false);
      notifyCalendarEventsChanged();
    } catch (error) {
      showRequestError(error, "회의록을 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 참석 상태 저장
  const handleAttendanceChange = async (userId: number, attendanceStatus: AttendanceStatus) => {
    if (!detail) return;
    const meetingId = detail.meeting.id;
    const previousParticipants = detail.participants;
    const participants = detail.participants.map((participant) => ({
      userId: participant.user_id,
      attendanceStatus: participant.user_id === userId ? attendanceStatus : participant.attendance_status,
    }));
    setDetail({
      ...detail,
      participants: detail.participants.map((participant) =>
        participant.user_id === userId ? { ...participant, attendance_status: attendanceStatus } : participant
      ),
    });
    try {
      await saveMeetingParticipants(meetingId, participants);
    } catch (error) {
      setDetail((current) =>
        current && current.meeting.id === meetingId ? { ...current, participants: previousParticipants } : current
      );
      showRequestError(error, "참석 상태를 저장하지 못했습니다. 이전 상태로 되돌렸습니다.");
    }
  };

  // 안건 추가
  const resetAgendaAddForm = () => {
    setAgendaTitle("");
    setAgendaPriority("normal");
    setAgendaStatus("waiting");
    setAgendaDiscussion("");
    setAgendaDecision("");
    setAgendaActionDrafts([{ content: "", managerId: null, dueStartDate: "", dueEndDate: "", status: "todo", calendarColor: "#56c7a5" }]);
  };

  // 안건 저장 완료 안내
  const showAgendaSavedAlert = () => {
    setAlertMessage("저장되었습니다.");
    setAlertOpen(true);
  };

  // 안건 추가
  const handleAddAgenda = async () => {
    if (!detail || !agendaTitle.trim()) return;
    const agendaResult = await createMeetingAgenda(detail.meeting.id, {
      title: agendaTitle,
      managerId: null,
      priority: agendaPriority,
      status: agendaStatus,
      sortOrder: detail.agendas.length,
    });
    if (agendaResult.agendaId) {
      const hasDiscussion = agendaDiscussion.trim() || agendaDecision.trim();
      const actionRows = agendaActionDrafts.filter((action) => action.content.trim());
      if (hasDiscussion || actionRows.length > 0) {
        const discussionResult = await createMeetingDiscussion(agendaResult.agendaId, {
          discussion: agendaDiscussion,
          decision: agendaDecision,
          sortOrder: 0,
        });
        if (discussionResult.discussionId) {
          for (const action of actionRows) {
            await createMeetingActionItem(agendaResult.agendaId, {
              discussionId: discussionResult.discussionId,
              content: action.content,
              managerId: action.managerId,
              dueStartDate: action.dueStartDate,
              dueEndDate: action.dueEndDate,
              status: action.status,
              calendarColor: action.calendarColor,
            });
          }
        }
      }
    }
    resetAgendaAddForm();
    setAgendaAddOpen(false);
    await reloadDetail();
    await reloadMeetings();
    notifyCalendarEventsChanged();
    showAgendaSavedAlert();
  };

  // 새 안건의 할 일 입력 행 수정
  const updateAgendaActionDraft = (index: number, patch: Partial<ActionDraft>) => {
    setAgendaActionDrafts((prev) => prev.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)));
  };

  // 새 안건의 할 일 입력 행 추가
  const addAgendaActionDraft = () => {
    setAgendaActionDrafts((prev) => [...prev, { content: "", managerId: null, dueStartDate: "", dueEndDate: "", status: "todo", calendarColor: "#56c7a5" }]);
  };

  // 안건 열기/닫기
  const toggleAgendaOpen = (agendaId: number) => {
    setOpenAgendaIds((prev) => {
      const closingAgendaIds = prev.has(agendaId) ? [...prev] : [...prev].filter((id) => id !== agendaId);
      if (closingAgendaIds.length > 0) {
        setCommentOpenAgendaIds((commentPrev) => {
          const next = new Set(commentPrev);
          closingAgendaIds.forEach((id) => next.delete(id));
          return next;
        });
        setCommentListOpenAgendaIds((commentPrev) => {
          const next = new Set(commentPrev);
          closingAgendaIds.forEach((id) => next.delete(id));
          return next;
        });
        if (editingCommentId) {
          const editingCommentAgendaId = detail?.comments.find((comment) => comment.id === editingCommentId)?.agenda_id;
          if (editingCommentAgendaId && closingAgendaIds.includes(editingCommentAgendaId)) {
            handleCancelEditComment();
          }
        }
      }
      if (prev.has(agendaId)) return new Set();
      return new Set([agendaId]);
    });
  };

  // 선택한 안건의 수정 입력값 구성
  const openAgendaEditor = (agenda: MeetingAgenda) => {
    const discussion = detail?.discussions.find((item) => item.agenda_id === agenda.id) ?? null;
    const actionDraftsForAgenda: Record<number, ActionDraft & { status: ActionStatus }> = {};
    for (const action of detail?.actionItems.filter((item) => item.agenda_id === agenda.id) ?? []) {
      actionDraftsForAgenda[action.id] = {
        content: action.content,
        managerId: action.manager_id,
        dueStartDate: action.due_start_date,
        dueEndDate: action.due_end_date,
        status: action.status,
        calendarColor: getActionCalendarColor(action),
      };
    }
    setEditingAgendaId(agenda.id);
    setEditingAgendaDraft({
      title: agenda.title,
      managerId: null,
      priority: agenda.priority,
      status: agenda.status,
    });
    setEditingDiscussionId(discussion?.id ?? null);
    setEditingDiscussionDraft(
      discussion
        ? {
            discussion: discussion.discussion,
            decision: discussion.decision,
          }
        : {
            discussion: "",
            decision: "",
          }
    );
    setEditingAgendaActionDrafts(actionDraftsForAgenda);
    // 다른 안건에서 작성하던 저장 전 할 일 행 제거
    setActionDraftRows({});
    if (discussion?.id) {
      setActionListOpenDiscussionIds((prev) => {
        const next = new Set(prev);
        next.add(discussion.id);
        return next;
      });
    }
    setOpenAgendaIds(new Set([agenda.id]));
  };

  // 안건 수정 취소
  const handleCancelEditAgenda = () => {
    setEditingAgendaId(null);
    setEditingAgendaDraft(null);
    setEditingDiscussionId(null);
    setEditingDiscussionDraft(null);
    setEditingAgendaActionDrafts({});
    setActionDraftRows({});
  };

  // 다른 안건 수정 중이면 취소 확인 후 새 안건 수정 시작
  const handleStartEditAgenda = (agenda: MeetingAgenda) => {
    if (editingAgendaId !== null && editingAgendaId !== agenda.id) {
      setPendingAgendaEditId(agenda.id);
      setAgendaCancelMode("switch");
      return;
    }

    openAgendaEditor(agenda);
  };

  // 안건 입력·수정 취소 또는 다른 안건으로 수정 전환
  const handleConfirmCancelAgenda = () => {
    if (agendaCancelMode === "add") {
      resetAgendaAddForm();
      setAgendaAddOpen(false);
    } else if (agendaCancelMode === "edit") {
      handleCancelEditAgenda();
    } else if (agendaCancelMode === "switch") {
      const nextAgenda = detail?.agendas.find((agenda) => agenda.id === pendingAgendaEditId);
      if (nextAgenda) {
        // 편집 대상을 한 번에 교체해 기존 안건은 조회 상태로 전환
        openAgendaEditor(nextAgenda);
      } else {
        handleCancelEditAgenda();
      }
    }

    setPendingAgendaEditId(null);
    setAgendaCancelMode(null);
  };

  // 안건 취소 확인창을 닫고 현재 수정 상태 유지
  const handleCloseAgendaCancel = () => {
    setPendingAgendaEditId(null);
    setAgendaCancelMode(null);
  };

  // 안건 수정 저장
  const handleSaveAgenda = async (agenda: MeetingAgenda) => {
    if (!editingAgendaDraft?.title.trim()) return;
    await updateMeetingAgenda(agenda.id, {
      title: editingAgendaDraft.title,
      managerId: null,
      priority: editingAgendaDraft.priority,
      status: editingAgendaDraft.status,
      sortOrder: agenda.sort_order,
    });
    let draftDiscussionId = editingDiscussionId ?? detail?.discussions.find((item) => item.agenda_id === agenda.id)?.id;
    if (editingDiscussionId && editingDiscussionDraft) {
      const discussion = detail?.discussions.find((item) => item.id === editingDiscussionId);
      await updateMeetingDiscussion(editingDiscussionId, {
        discussion: editingDiscussionDraft.discussion,
        decision: editingDiscussionDraft.decision,
        sortOrder: discussion?.sort_order ?? 0,
      });
    } else if (editingDiscussionDraft && (editingDiscussionDraft.discussion.trim() || editingDiscussionDraft.decision.trim())) {
      const discussionResult = await createMeetingDiscussion(agenda.id, {
        discussion: editingDiscussionDraft.discussion,
        decision: editingDiscussionDraft.decision,
        sortOrder: 0,
      });
      draftDiscussionId = discussionResult.discussionId;
    }
    for (const [actionId, draft] of Object.entries(editingAgendaActionDrafts)) {
      if (draft.content.trim()) {
        await updateMeetingActionItem(Number(actionId), draft);
      }
    }
    if (draftDiscussionId) {
      const rows = (actionDraftRows[draftDiscussionId] ?? []).filter((draft) => draft.content.trim());
      for (const draft of rows) {
        await createMeetingActionItem(agenda.id, {
          discussionId: draftDiscussionId,
          content: draft.content,
          managerId: draft.managerId,
          dueStartDate: draft.dueStartDate,
          dueEndDate: draft.dueEndDate,
          status: draft.status,
          calendarColor: draft.calendarColor,
        });
      }
      setActionDraftRows((prev) => {
        const next = { ...prev };
        delete next[draftDiscussionId];
        return next;
      });
    }
    handleCancelEditAgenda();
    await reloadDetail();
    await reloadMeetings();
    notifyCalendarEventsChanged();
    showAgendaSavedAlert();
  };

  // 안건 삭제
  const handleDeleteAgenda = async () => {
    if (!deleteAgendaId) return;
    await deleteMeetingAgenda(deleteAgendaId);
    setOpenAgendaIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteAgendaId);
      return next;
    });
    setDeleteAgendaId(null);
    await reloadDetail();
    await reloadMeetings();
    notifyCalendarEventsChanged();
  };

  // 논의/결정 수정 취소
  const handleCancelEditDiscussion = () => {
    setEditingDiscussionId(null);
    setEditingDiscussionDraft(null);
  };

  // 논의/결정 삭제
  const handleDeleteDiscussion = async () => {
    if (!deleteDiscussionId) return;
    await deleteMeetingDiscussion(deleteDiscussionId);
    setDeleteDiscussionId(null);
    if (editingDiscussionId === deleteDiscussionId) handleCancelEditDiscussion();
    await reloadDetail();
    notifyCalendarEventsChanged();
  };

  // 기존 안건의 할 일 입력 행 추가
  const addActionDraftRow = (discussionId: number) => {
    setActionDraftRows((prev) => ({
      ...prev,
      [discussionId]: [
        ...(prev[discussionId] ?? []),
        { content: "", managerId: null, dueStartDate: "", dueEndDate: "", status: "todo", calendarColor: "#56c7a5" },
      ],
    }));
    setActionListOpenDiscussionIds((prev) => {
      const next = new Set(prev);
      next.add(discussionId);
      return next;
    });
  };

  // 할 일 목록 열기/닫기
  const toggleActionList = (discussionId: number) => {
    setActionListOpenDiscussionIds((prev) => {
      const next = new Set(prev);
      if (next.has(discussionId)) next.delete(discussionId);
      else next.add(discussionId);
      return next;
    });
  };

  // 기존 안건의 할 일 입력 행 수정
  const updateActionDraftRow = (discussionId: number, index: number, patch: Partial<ActionDraft>) => {
    setActionDraftRows((prev) => ({
      ...prev,
      [discussionId]: (prev[discussionId] ?? []).map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft
      ),
    }));
  };

  // 할 일 수정 취소
  const handleCancelEditAction = () => {
    setEditingActionId(null);
    setEditingActionDraft(null);
  };

  // 할 일 수정 저장
  const handleSaveAction = async (actionId: number) => {
    if (!editingActionDraft?.content.trim()) return;
    await updateMeetingActionItem(actionId, editingActionDraft);
    handleCancelEditAction();
    await reloadDetail();
    await reloadMeetings();
    notifyCalendarEventsChanged();
  };

  // 할 일 삭제
  const handleDeleteAction = async () => {
    if (!deleteActionId) return;
    await deleteMeetingActionItem(deleteActionId);
    setDeleteActionId(null);
    if (editingActionId === deleteActionId) handleCancelEditAction();
    await reloadDetail();
    await reloadMeetings();
    notifyCalendarEventsChanged();
  };

  // 할 일을 캘린더 일정으로 저장
  const handleSyncActionToCalendar = async (action: MeetingActionItem, color: string) => {
    await updateMeetingActionItem(action.id, {
      content: action.content,
      managerId: action.manager_id,
      dueStartDate: action.due_start_date,
      dueEndDate: action.due_end_date,
      status: action.status,
      calendarColor: color,
    });
    await syncMeetingActionItemToCalendar(action.id);
    await reloadDetail();
    notifyCalendarEventsChanged();
    setAlertMessage(action.calendar_event_id ? "수정 완료되었습니다." : "캘린더에 저장되었습니다.");
    setAlertOpen(true);
  };

  // 수정 중인 할 일을 저장한 뒤 캘린더 일정으로 반영
  const handleSaveAndSyncActionToCalendar = async (actionId: number, draft: ActionDraft) => {
    if (!draft.content.trim()) return;
    await updateMeetingActionItem(actionId, draft);
    await syncMeetingActionItemToCalendar(actionId);
    await reloadDetail();
    await reloadMeetings();
    notifyCalendarEventsChanged();
    setAlertMessage("수정 완료되었습니다.");
    setAlertOpen(true);
  };

  const meetingTitleText = detail ? form.title || detail.meeting.title : isCreating ? form.title || "새 회의" : "회의 선택";
  const meetingSummaryText = detail
    ? `${meetingTypeLabels[form.meetingType]} · ${formatDateTime(form.meetingAt)} · ${form.location || "장소 없음"} · ${
        meetingStatusLabels[form.status]
      }`
    : "";
  const canDeleteMeeting = !!detail && detail.meeting.created_by === detail.currentUserId;

  return {
    shouldShowMeetingForm,
    meetingFormChanged,
    agendaAddChanged,
    hasUnsavedChanges,
    showRequestError,
    agendaChildren,
    reloadMeetings,
    reloadDetail,
    startNewMeeting,
    selectMeeting,
    changeMeetingCalendar,
    requestMeetingNavigation,
    handleConfirmMeetingNavigation,
    handleSaveMeeting,
    handleDeleteMeeting,
    handleAttendanceChange,
    resetAgendaAddForm,
    handleConfirmCancelAgenda,
    handleCloseAgendaCancel,
    showAgendaSavedAlert,
    handleAddAgenda,
    updateAgendaActionDraft,
    addAgendaActionDraft,
    toggleAgendaOpen,
    handleStartEditAgenda,
    handleCancelEditAgenda,
    handleSaveAgenda,
    handleDeleteAgenda,
    handleCancelEditDiscussion,
    handleDeleteDiscussion,
    addActionDraftRow,
    toggleActionList,
    updateActionDraftRow,
    handleCancelEditAction,
    handleSaveAction,
    handleDeleteAction,
    toggleCommentInput,
    toggleCommentList,
    handleSaveComment,
    setCommentPage,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveEditedComment,
    handleDeleteComment,
    handleSyncActionToCalendar,
    handleSaveAndSyncActionToCalendar,
    meetingTitleText,
    meetingSummaryText,
    canDeleteMeeting,
    calendars,
    setCalendars,
    meetings,
    setMeetings,
    selectedMeetingId,
    setSelectedMeetingId,
    meetingListPinnedOpen,
    setMeetingListPinnedOpen,
    meetingListHoverReady,
    setMeetingListHoverReady,
    mobileMeetingListOpen,
    setMobileMeetingListOpen,
    isCreating,
    setIsCreating,
    detail,
    setDetail,
    members,
    setMembers,
    keyword,
    setKeyword,
    loading,
    setLoading,
    saving,
    setSaving,
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
    setAlertMessage,
    alertOpen,
    setAlertOpen,
    meetingFormBaseline,
    setMeetingFormBaseline,
    pendingNavigation,
    setPendingNavigation,
    actionColorDrafts,
    setActionColorDrafts,
    agendaTitle,
    setAgendaTitle,
    agendaPriority,
    setAgendaPriority,
    agendaStatus,
    setAgendaStatus,
    agendaDiscussion,
    setAgendaDiscussion,
    agendaDecision,
    setAgendaDecision,
    agendaActionDrafts,
    setAgendaActionDrafts,
    agendaAddOpen,
    setAgendaAddOpen,
    agendaCancelMode,
    setAgendaCancelMode,
    editingAgendaId,
    setEditingAgendaId,
    editingAgendaDraft,
    setEditingAgendaDraft,
    openAgendaIds,
    setOpenAgendaIds,
    meetingInfoOpen,
    setMeetingInfoOpen,
    editingDiscussionId,
    setEditingDiscussionId,
    editingDiscussionDraft,
    setEditingDiscussionDraft,
    actionDraftRows,
    setActionDraftRows,
    actionListOpenDiscussionIds,
    setActionListOpenDiscussionIds,
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
    editingAgendaActionDrafts,
    setEditingAgendaActionDrafts,
    editingActionId,
    setEditingActionId,
    editingActionDraft,
    setEditingActionDraft,
    form,
    setForm,
    favoriteColors,
  };
}

// 회의록 하위 화면이 동일한 상태와 작업 타입을 공유할 때 사용
export type MeetingReportController = ReturnType<typeof useMeetingReport>;
