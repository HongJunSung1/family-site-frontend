import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ActionStatus, MeetingActionItem } from "../../../api/meetingApi";
import { Input } from "../../../common/input";
import type { FavoriteColorPreset } from "../calendar/hooks/useFavoriteColors";
import {
  actionStatusLabels, canSyncActionDraftToCalendar, canSyncActionToCalendar,
  formatDateInput, getActionCalendarColor, type MeetingReportController,
} from "./useMeetingReport";
import reportStyles from "./ConferenceReport.module.css";

type ActionItemSectionProps = {
  report: MeetingReportController;
  discussionId: number;
  actions: MeetingActionItem[];
  editable?: boolean;
};

// 새 안건에 포함할 할 일 입력 행 목록
export function NewActionItemSection({ report }: { report: MeetingReportController }) {
  const {
    members,
    agendaActionDrafts,
    addAgendaActionDraft,
    updateAgendaActionDraft,
  } = report;

  return (
    <div className={reportStyles.actionPanel}>
      <div className={`${reportStyles.actionPanelTitle} ${reportStyles.actionPanelTitleNoChevron}`}>
        <strong>할 일</strong>
        <button type="button" className={reportStyles.inlineAddButton} onClick={addAgendaActionDraft}>
          +할 일 추가
        </button>
      </div>
      <div className={reportStyles.actionList}>
        <div className={reportStyles.actionTableHeader}>
          <span>담당</span>
          <span>내용</span>
          <span className={reportStyles.actionPeriodHeader}><span>기간Fr</span><span>기간To</span></span>
          <span>상태</span>
          <span>관리</span>
        </div>
        {agendaActionDrafts.map((action, actionIndex) => (
          <div className={reportStyles.actionAddRow} key={actionIndex}>
            <div className={reportStyles.actionCell}>
              <span className={reportStyles.actionCellLabel}>담당</span>
              <select
                className={reportStyles.select}
                value={action.managerId ?? ""}
                onChange={(event) =>
                  updateAgendaActionDraft(actionIndex, {
                    managerId: event.target.value ? Number(event.target.value) : null,
                  })
                }
              >
                <option value="">담당자 없음</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </div>
            <div className={`${reportStyles.actionCell} ${reportStyles.actionCellWide}`}>
              <span className={reportStyles.actionCellLabel}>내용</span>
              <Input
                value={action.content}
                onChange={(event) => updateAgendaActionDraft(actionIndex, { content: event.target.value })}
                placeholder="할 일"
              />
            </div>
            <div className={`${reportStyles.actionCell} ${reportStyles.actionCellPeriod}`}>
              <span className={reportStyles.actionCellLabel}>기간</span>
              <div className={reportStyles.actionPeriodInputs}>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="기간Fr"
                  value={action.dueStartDate}
                  onChange={(event) => updateAgendaActionDraft(actionIndex, { dueStartDate: formatDateInput(event.target.value) })}
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="기간To"
                  value={action.dueEndDate}
                  onChange={(event) => updateAgendaActionDraft(actionIndex, { dueEndDate: formatDateInput(event.target.value) })}
                />
              </div>
            </div>
            <div className={reportStyles.actionCell}>
              <span className={reportStyles.actionCellLabel}>상태</span>
              <select
                className={reportStyles.select}
                value={action.status}
                onChange={(event) => updateAgendaActionDraft(actionIndex, { status: event.target.value as ActionStatus })}
              >
                {Object.entries(actionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className={`${reportStyles.actionCell} ${reportStyles.actionCellActions}`} aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}

type CompactColorPickerProps = {
  color: string;
  favoriteColors: FavoriteColorPreset[];
  onChange: (color: string) => void;
};

// 할 일 테이블용 작은 색상 선택 팝오버
function CompactActionColorPicker({ color, favoriteColors, onChange }: CompactColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const width = 220;
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 220);
    setPopoverStyle({ top, left, width });
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={reportStyles.colorChipButton}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="할 일 색상 선택"
      >
        <span className={reportStyles.colorChip} style={{ backgroundColor: color }} />
      </button>
      {open &&
        createPortal(
          <div ref={popoverRef} className={reportStyles.colorChipPopover} style={popoverStyle}>
            <label className={reportStyles.colorChipPickerRow}>
              <span>색상</span>
              <input type="color" value={color} onChange={(event) => onChange(event.target.value)} />
            </label>

            {favoriteColors.length > 0 && (
              <div className={reportStyles.colorChipPresetList}>
                {favoriteColors.map((preset) => (
                  <button
                    type="button"
                    key={preset.slot}
                    className={reportStyles.colorChipPreset}
                    onClick={() => {
                      onChange(preset.color);
                      setOpen(false);
                    }}
                  >
                    <span style={{ backgroundColor: preset.color }} />
                    <strong>{preset.label?.trim() || preset.color}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}


// 논의에 연결된 할 일 작성·수정·삭제와 캘린더 연동 관리
export function ActionItemSection({ report, discussionId, actions, editable = false }: ActionItemSectionProps) {
  const {
    addActionDraftRow,
    toggleActionList,
    updateActionDraftRow,
    handleCancelEditAction,
    handleSaveAction,
    handleSyncActionToCalendar,
    handleSaveAndSyncActionToCalendar,
    members,
    setDeleteActionId,
    actionColorDrafts,
    setActionColorDrafts,
    actionDraftRows,
    actionListOpenDiscussionIds,
    editingAgendaActionDrafts,
    setEditingAgendaActionDrafts,
    editingActionId,
    editingActionDraft,
    setEditingActionDraft,
    favoriteColors,
  } = report;
    const draftRows = actionDraftRows[discussionId] ?? [];
    const listOpen = actionListOpenDiscussionIds.has(discussionId);
    const actionCount = actions.length + draftRows.length;
    const renderField = (label: string, content: ReactNode, extraClass = "") => (
      <div className={[reportStyles.actionCell, extraClass].filter(Boolean).join(" ")}>
        <span className={reportStyles.actionCellLabel}>{label}</span>
        {content}
      </div>
    );

    return (
      <div className={reportStyles.actionPanel}>
        <div className={reportStyles.actionPanelTitle} onClick={() => toggleActionList(discussionId)}>
          <div className={reportStyles.actionTitleGroup}>
            <strong>할 일</strong>
            <span className={reportStyles.commentCount}>{actionCount}</span>
          </div>
          {editable && (
            <button
              type="button"
              className={reportStyles.inlineAddButton}
              onClick={(event) => {
                event.stopPropagation();
                addActionDraftRow(discussionId);
              }}
            >
              +할 일 추가
            </button>
          )}
          <span className={`${reportStyles.chevron} ${reportStyles.actionHeaderChevron} ${listOpen ? reportStyles.chevronOpen : ""}`}>›</span>
        </div>

        {listOpen && <div className={reportStyles.actionList}>
          {draftRows.map((actionDraft, draftIndex) => (
            <div className={reportStyles.actionAddRow} key={`draft-${draftIndex}`}>
              {renderField(
                "담당",
                <select
                  className={reportStyles.select}
                  value={actionDraft.managerId ?? ""}
                  onChange={(event) =>
                    updateActionDraftRow(discussionId, draftIndex, {
                      managerId: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                >
                  <option value="">담당자 없음</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              )}
              {renderField(
                "내용",
                <Input
                  value={actionDraft.content}
                  onChange={(event) =>
                    updateActionDraftRow(discussionId, draftIndex, {
                      content: event.target.value,
                    })
                  }
                  placeholder="할 일"
                />,
                reportStyles.actionCellWide
              )}
              {renderField(
                "기간",
                <div className={reportStyles.actionPeriodInputs}>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="기간Fr"
                    value={actionDraft.dueStartDate}
                    onChange={(event) =>
                      updateActionDraftRow(discussionId, draftIndex, {
                        dueStartDate: formatDateInput(event.target.value),
                      })
                    }
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="기간To"
                    value={actionDraft.dueEndDate}
                    onChange={(event) =>
                      updateActionDraftRow(discussionId, draftIndex, {
                        dueEndDate: formatDateInput(event.target.value),
                      })
                    }
                  />
                </div>,
                reportStyles.actionCellPeriod
              )}
              {renderField(
                "상태",
                <select
                  className={reportStyles.select}
                  value={actionDraft.status}
                  onChange={(event) =>
                    updateActionDraftRow(discussionId, draftIndex, {
                      status: event.target.value as ActionStatus,
                    })
                  }
                >
                  {Object.entries(actionStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
              <div className={`${reportStyles.actionCell} ${reportStyles.actionCellActions}`} aria-hidden="true" />
            </div>
          ))}
          {actions.map((action) => (
            <div className={reportStyles.actionRow} key={action.id}>
              {editable && editingAgendaActionDrafts[action.id] ? (
                <>
                  {renderField(
                    "담당",
                    <select
                      className={reportStyles.select}
                      value={editingAgendaActionDrafts[action.id].managerId ?? ""}
                      onChange={(event) =>
                        setEditingAgendaActionDrafts((prev) => ({
                          ...prev,
                          [action.id]: {
                            ...prev[action.id],
                            managerId: event.target.value ? Number(event.target.value) : null,
                          },
                        }))
                      }
                    >
                      <option value="">담당자 없음</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {renderField(
                    "내용",
                    <Input
                      value={editingAgendaActionDrafts[action.id].content}
                      onChange={(event) =>
                        setEditingAgendaActionDrafts((prev) => ({
                          ...prev,
                          [action.id]: { ...prev[action.id], content: event.target.value },
                        }))
                      }
                    />,
                    reportStyles.actionCellWide
                  )}
                  {renderField(
                    "기간",
                    <div className={reportStyles.actionPeriodInputs}>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={editingAgendaActionDrafts[action.id].dueStartDate}
                        onChange={(event) =>
                          setEditingAgendaActionDrafts((prev) => ({
                            ...prev,
                            [action.id]: { ...prev[action.id], dueStartDate: formatDateInput(event.target.value) },
                          }))
                        }
                      />
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={editingAgendaActionDrafts[action.id].dueEndDate}
                        onChange={(event) =>
                          setEditingAgendaActionDrafts((prev) => ({
                            ...prev,
                            [action.id]: { ...prev[action.id], dueEndDate: formatDateInput(event.target.value) },
                          }))
                        }
                      />
                    </div>,
                    reportStyles.actionCellPeriod
                  )}
                  {renderField(
                    "상태",
                    <select
                      className={reportStyles.select}
                      value={editingAgendaActionDrafts[action.id].status}
                      onChange={(event) =>
                        setEditingAgendaActionDrafts((prev) => ({
                          ...prev,
                          [action.id]: { ...prev[action.id], status: event.target.value as ActionStatus },
                        }))
                      }
                    >
                      {Object.entries(actionStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                  {renderField(
                    "관리",
                    <div className={reportStyles.rowActions}>
                      {canSyncActionDraftToCalendar(editingAgendaActionDrafts[action.id]) && (
                        <>
                          <CompactActionColorPicker
                            color={editingAgendaActionDrafts[action.id].calendarColor}
                            favoriteColors={favoriteColors}
                            onChange={(color) =>
                              setEditingAgendaActionDrafts((prev) => ({
                                ...prev,
                                [action.id]: { ...prev[action.id], calendarColor: color },
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={reportStyles.ghostButton}
                            onClick={() => handleSaveAndSyncActionToCalendar(action.id, editingAgendaActionDrafts[action.id])}
                          >
                            {action.calendar_event_id ? "캘린더 수정" : "캘린더 저장"}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className={`${reportStyles.dangerButton} ${reportStyles.actionDeleteButton}`}
                        onClick={() => setDeleteActionId(action.id)}
                        aria-label="할 일 삭제"
                      >
                        <span>삭제</span>
                      </button>
                    </div>,
                    reportStyles.actionCellActions
                  )}
                </>
              ) : editingActionId === action.id && editingActionDraft ? (
                <>
                  {renderField(
                    "담당",
                    <select
                      className={reportStyles.select}
                      value={editingActionDraft.managerId ?? ""}
                      onChange={(event) =>
                        setEditingActionDraft({
                          ...editingActionDraft,
                          managerId: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                    >
                      <option value="">담당자 없음</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {renderField(
                    "내용",
                    <Input
                      value={editingActionDraft.content}
                      onChange={(event) => setEditingActionDraft({ ...editingActionDraft, content: event.target.value })}
                    />,
                    reportStyles.actionCellWide
                  )}
                  {renderField(
                    "기간",
                    <div className={reportStyles.actionPeriodInputs}>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={editingActionDraft.dueStartDate}
                        onChange={(event) =>
                          setEditingActionDraft({ ...editingActionDraft, dueStartDate: formatDateInput(event.target.value) })
                        }
                      />
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={editingActionDraft.dueEndDate}
                        onChange={(event) =>
                          setEditingActionDraft({ ...editingActionDraft, dueEndDate: formatDateInput(event.target.value) })
                        }
                      />
                    </div>,
                    reportStyles.actionCellPeriod
                  )}
                  {renderField(
                    "상태",
                    <select
                      className={reportStyles.select}
                      value={editingActionDraft.status}
                      onChange={(event) =>
                        setEditingActionDraft({
                          ...editingActionDraft,
                          status: event.target.value as ActionStatus,
                        })
                      }
                    >
                      {Object.entries(actionStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                  {renderField(
                    "관리",
                    <div className={reportStyles.rowActions}>
                      <button type="button" className={reportStyles.primaryButton} onClick={() => handleSaveAction(action.id)}>
                        저장
                      </button>
                      <button type="button" className={reportStyles.ghostButton} onClick={handleCancelEditAction}>
                        취소
                      </button>
                    </div>,
                    reportStyles.actionCellActions
                  )}
                </>
              ) : (
                <>
                  {renderField("담당", <strong className={reportStyles.actionManagerText}>{action.manager_name ?? "없음"}</strong>)}
                  {renderField("내용", <span className={reportStyles.actionContentText}>{action.content}</span>, reportStyles.actionCellWide)}
                  {renderField(
                    "기간",
                    <span className={reportStyles.actionDateRange}>
                      {action.due_start_date || "-"} <span>~</span> {action.due_end_date || "-"}
                    </span>,
                    reportStyles.actionCellPeriod
                  )}
                  {renderField("상태", <span className={reportStyles.actionStatusBadge}>{actionStatusLabels[action.status]}</span>)}
                  {renderField(
                    "관리",
                    <div className={reportStyles.rowActions}>
                      {canSyncActionToCalendar(action) && (
                        <>
                          <CompactActionColorPicker
                            color={actionColorDrafts[action.id] ?? getActionCalendarColor(action)}
                            favoriteColors={favoriteColors}
                            onChange={(color) => setActionColorDrafts((prev) => ({ ...prev, [action.id]: color }))}
                          />
                          <button
                            type="button"
                            className={reportStyles.ghostButton}
                            onClick={() => handleSyncActionToCalendar(action, actionColorDrafts[action.id] ?? getActionCalendarColor(action))}
                          >
                            {action.calendar_event_id ? "캘린더 수정" : "캘린더 저장"}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className={`${reportStyles.dangerButton} ${reportStyles.actionDeleteButton}`}
                        onClick={() => setDeleteActionId(action.id)}
                        aria-label="할 일 삭제"
                      >
                        <span>삭제</span>
                      </button>
                    </div>,
                    reportStyles.actionCellActions
                  )}
                </>
              )}
            </div>
          ))}
        </div>}
      </div>
    );
}
