import { Input } from "../../../common/input";
import {
  formatDateTime, meetingStatusLabels, meetingTypeLabels,
  type MeetingReportController,
} from "./useMeetingReport";
import reportStyles from "./ConferenceReport.module.css";

// 회의 검색·선택과 PC 고정/자동, 모바일 접기 상태 표시
export function MeetingListPanel({ report }: { report: MeetingReportController }) {
  const {
    reloadMeetings,
    requestMeetingNavigation,
    calendars,
    meetings,
    selectedMeetingId,
    meetingListPinnedOpen,
    setMeetingListPinnedOpen,
    setMeetingListHoverReady,
    mobileMeetingListOpen,
    setMobileMeetingListOpen,
    keyword,
    setKeyword,
    form,
  } = report;

  return (
        <section
          className={[
            reportStyles.panel,
            reportStyles.meetingListPanel,
            !mobileMeetingListOpen ? reportStyles.meetingListPanelMobileCollapsed : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseLeave={() => {
            if (!meetingListPinnedOpen) setMeetingListHoverReady(true);
          }}
        >
          <header className={reportStyles.panelHeader}>
            <div className={reportStyles.titleRow}>
              <h1>회의 목록</h1>
              <div className={reportStyles.meetingListHeaderActions}>
                <label className={reportStyles.desktopListMode}>
                  <input
                    type="checkbox"
                    checked={meetingListPinnedOpen}
                    onChange={(event) => {
                      setMeetingListPinnedOpen(event.target.checked);
                      setMeetingListHoverReady(true);
                    }}
                  />
                  <span className={reportStyles.listModeSwitch} aria-hidden="true" />
                </label>
                <button
                  type="button"
                  className={reportStyles.mobileListToggle}
                  onClick={() => setMobileMeetingListOpen((prev) => !prev)}
                >
                  {mobileMeetingListOpen ? "접기" : "회의 목록 보기"}
                </button>
                <button
                  type="button"
                  className={reportStyles.primaryButton}
                  onClick={() => requestMeetingNavigation({ type: "new" })}
                >
                  새 회의
                </button>
              </div>
            </div>
            <div className={reportStyles.filters}>
              <select
                className={reportStyles.select}
                value={form.calendarId}
                onChange={(event) => requestMeetingNavigation({ type: "calendar", calendarId: Number(event.target.value) })}
              >
                {calendars.map((calendar) => (
                  <option key={calendar.calendarId} value={calendar.calendarId}>
                    {calendar.name}
                  </option>
                ))}
              </select>
              <div className={reportStyles.searchBox}>
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") reloadMeetings();
                  }}
                  placeholder="회의명 검색"
                  rightSlot={
                    <button
                      type="button"
                      className={reportStyles.searchButton}
                      aria-label="회의명 검색"
                      onClick={() => reloadMeetings()}
                    >
                      <span className={reportStyles.searchIcon} aria-hidden="true" />
                    </button>
                  }
                />
              </div>
            </div>
          </header>

          <div className={reportStyles.list}>
            {meetings.map((meeting) => (
              <button
                key={meeting.id}
                type="button"
                className={[reportStyles.meetingCard, meeting.id === selectedMeetingId ? reportStyles.meetingCardActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  requestMeetingNavigation({ type: "meeting", meetingId: meeting.id });
                }}
              >
                <strong>{meeting.title}</strong>
                <span className={reportStyles.meetingMeta}>
                  <span>{formatDateTime(meeting.meeting_at)}</span>
                  <span>{meetingTypeLabels[meeting.meeting_type]}</span>
                  <span>{meetingStatusLabels[meeting.status]}</span>
                </span>
                <span className={reportStyles.meetingMeta}>
                  <span>안건 {meeting.agenda_count}개</span>
                  <span>남은 할 일 {meeting.action_count}개</span>
                </span>
              </button>
            ))}
            {meetings.length === 0 && <div className={reportStyles.empty}>등록된 회의가 없습니다.</div>}
          </div>
        </section>
  );
}

