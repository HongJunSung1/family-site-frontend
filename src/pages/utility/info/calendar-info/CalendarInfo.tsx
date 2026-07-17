import { Fragment, useEffect, useState } from "react";
import { hasAccessToken } from "../../../../api/client";
import {
  deleteMyCalendar,
  getCalendarDetail,
  getMyCalendarsInfo,
  saveMyCalendarsInfo,
  type CalendarMemberItem,
  type GetMyCalendarsInfoResponse,
} from "../../../../api/calendarApi";
import { ConfirmDialog } from "../../../../common/dialog";
import { TableInput } from "../../../../common/input";
import { FamilyLoader } from "../../../../common/loading";
import CalendarInvitePopup from "./CalendarInvitePopup";
import styles from "./CalendarInfo.module.css";

// 알 수 없는 API 예외에서 사용자 안내 문구 추출
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

// 사용자가 소유하거나 참여 중인 캘린더 목록과 회원 정보 관리
export default function CalendarInfo() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [data, setData] = useState<GetMyCalendarsInfoResponse | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);
  const [tabOrders, setTabOrders] = useState<Record<number, string>>({});
  const [calendarNames, setCalendarNames] = useState<Record<number, string>>({});
  const [addingCalendar, setAddingCalendar] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const [newCalendarMain, setNewCalendarMain] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCalendarId, setInviteCalendarId] = useState<number | null>(null);
  const [inviteCalendarName, setInviteCalendarName] = useState("");
  const [openMemberCalendarId, setOpenMemberCalendarId] = useState<number | null>(null);
  const [memberMap, setMemberMap] = useState<Record<number, CalendarMemberItem[]>>({});
  const [memberPageMap, setMemberPageMap] = useState<Record<number, number>>({});
  const [memberLoadingMap, setMemberLoadingMap] = useState<Record<number, boolean>>({});
  const [deleteCalendarId, setDeleteCalendarId] = useState<number | null>(null);

  // 서버 캘린더 목록과 기본 회원 정보 조회
  const loadCalendarInfo = async () => {
    if (!hasAccessToken()) {
      setErrorMsg("로그인 정보가 없습니다.");
      setLoading(false);
      return;
    }

    try {
      const result = await getMyCalendarsInfo();
      if (!result.ok) {
        setErrorMsg("캘린더 정보를 불러오지 못했습니다.");
        return;
      }

      setData(result);
      setSelectedCalendarId(result.defaultCalendarId ?? null);

      const initialTabOrders: Record<number, string> = {};
      const initialNames: Record<number, string> = {};

      for (const calendar of result.calendars) {
        initialNames[calendar.id] = calendar.name;
        initialTabOrders[calendar.id] =
          result.defaultCalendarId === calendar.id
            ? "0"
            : calendar.tab_order == null
            ? ""
            : String(calendar.tab_order);
      }

      setTabOrders(initialTabOrders);
      setCalendarNames(initialNames);
    } catch (err) {
      console.error(err);
      setErrorMsg("서버 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarInfo();
  }, []);

  // 화면 표시용 캘린더 순서 정렬
  const getSortedCalendars = () => {
    if (!data?.calendars) return [];

    return [...data.calendars].sort((a, b) => {
      const aOrder = selectedCalendarId === a.id ? 0 : Number(tabOrders[a.id] ?? a.tab_order ?? 999999);
      const bOrder = selectedCalendarId === b.id ? 0 : Number(tabOrders[b.id] ?? b.tab_order ?? 999999);
      return aOrder - bOrder;
    });
  };

  // 변경된 캘린더 순서 즉시 저장
  const saveCalendarOrderImmediately = async (
    orderedCalendarIds: number[],
    nextDefaultCalendarId: number | null
  ) => {
    if (!data) return;

    setErrorMsg("");
    setSuccessMsg("");
    setSaving(true);

    try {
      if (!hasAccessToken()) {
        setErrorMsg("로그인 정보가 없습니다.");
        return;
      }

      const calendarsPayload = orderedCalendarIds.map((calendarId, index) => {
        const calendar = data.calendars.find((item) => item.id === calendarId);
        if (!calendar) throw new Error("캘린더 정보를 찾을 수 없습니다.");

        return {
          calendarId,
          name: (calendarNames[calendarId] ?? calendar.name).trim(),
          tabOrder: index,
        };
      });

      const result = await saveMyCalendarsInfo({
        defaultCalendarId: nextDefaultCalendarId,
        newCalendarMain: false,
        calendars: calendarsPayload,
      });

      if (!result.ok) {
        setErrorMsg(result.message ?? "순서 저장 중 오류가 발생했습니다.");
        return;
      }

      await loadCalendarInfo();
      setSuccessMsg("순서가 변경되었습니다.");
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "순서 저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  };

  // 캘린더 순서 위/아래 이동
  const handleMoveCalendar = async (calendarId: number, direction: "up" | "down") => {
    if (!data || saving) return;

    const sorted = getSortedCalendars();
    const currentIndex = sorted.findIndex((item) => item.id === calendarId);
    if (currentIndex < 0) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === sorted.length - 1) return;

    const next = [...sorted];
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];

    await saveCalendarOrderImmediately(
      next.map((item) => item.id),
      selectedCalendarId
    );
  };

  // 선택한 캘린더의 메인 캘린더 설정
  const handleCheckChange = async (calendarId: number) => {
    if (!data || saving) return;

    setErrorMsg("");
    setSuccessMsg("");
    setNewCalendarMain(false);
    setSelectedCalendarId(calendarId);

    const sorted = getSortedCalendars();
    const selected = sorted.find((item) => item.id === calendarId);
    if (!selected) return;

    const orderedCalendarIds = [selected, ...sorted.filter((item) => item.id !== calendarId)].map(
      (item) => item.id
    );

    const nextOrders: Record<number, string> = {};
    orderedCalendarIds.forEach((id, index) => {
      nextOrders[id] = String(index);
    });

    setTabOrders(nextOrders);
    await saveCalendarOrderImmediately(orderedCalendarIds, calendarId);
  };

  // 캘린더 이름 입력값 화면 상태 반영
  const handleCalendarNameChange = (calendarId: number, isOwner: boolean, value: string) => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!isOwner) {
      return;
    }

    setCalendarNames((prev) => ({ ...prev, [calendarId]: value }));
  };

  // 새 캘린더 추가용 임시 행 열기
  const handleAddCalendarRow = () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (addingCalendar) return;

    setAddingCalendar(true);
    setNewCalendarName("");
    setNewCalendarMain(false);
  };

  // 캘린더 이름 변경과 새 캘린더 추가 내용 저장
  const handleSave = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!data) return;

    try {
      const usedOrders = new Set<number>();

      const calendarsPayload = data.calendars.map((calendar) => {
        const rawName = (calendarNames[calendar.id] ?? "").trim();
        if (!rawName) throw new Error("캘린더명을 비워둘 수 없습니다.");

        let rawValue = tabOrders[calendar.id] ?? "";
        if (selectedCalendarId === calendar.id) rawValue = "0";

        if (rawValue === "") {
          return { calendarId: calendar.id, name: rawName, tabOrder: null };
        }

        const num = Number(rawValue);
        if (!Number.isInteger(num)) throw new Error("표시 순서는 정수만 입력할 수 있습니다.");
        if (num < 0) throw new Error("표시 순서는 0 이상의 정수만 가능합니다.");
        if (usedOrders.has(num)) throw new Error("캘린더 표시 순서는 중복될 수 없습니다.");

        usedOrders.add(num);
        return { calendarId: calendar.id, name: rawName, tabOrder: num };
      });

      if (addingCalendar) {
        const trimmedNewName = newCalendarName.trim();
        if (!trimmedNewName) throw new Error("새 캘린더명을 입력해주세요.");

        if (newCalendarMain) {
          calendarsPayload.forEach((item) => {
            item.tabOrder = item.tabOrder === null ? null : item.tabOrder + 1;
          });
          calendarsPayload.push({ calendarId: 0, name: trimmedNewName, tabOrder: 0 });
        } else {
          const maxOrder =
            calendarsPayload.length === 0
              ? -1
              : Math.max(...calendarsPayload.map((item) => (item.tabOrder === null ? -1 : item.tabOrder)));
          calendarsPayload.push({ calendarId: 0, name: trimmedNewName, tabOrder: maxOrder + 1 });
        }
      }

      setSaving(true);

      if (!hasAccessToken()) {
        setErrorMsg("로그인 정보가 없습니다.");
        return;
      }

      const result = await saveMyCalendarsInfo({
        defaultCalendarId: newCalendarMain ? null : selectedCalendarId,
        newCalendarMain,
        calendars: calendarsPayload,
      });

      if (!result.ok) {
        setErrorMsg(result.message ?? "저장 중 오류가 발생했습니다.");
        return;
      }

      setAddingCalendar(false);
      setNewCalendarName("");
      setNewCalendarMain(false);
      await loadCalendarInfo();
      setSuccessMsg("저장되었습니다.");
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  };

  // 삭제할 캘린더 선택과 확인창 열기
  const handleDeleteClick = (calendarId: number) => {
    setErrorMsg("");
    setSuccessMsg("");
    setDeleteCalendarId(calendarId);
  };

  // 삭제 확인 후 서버 캘린더 제거
  const handleConfirmDelete = async () => {
    if (deleteCalendarId == null) return;

    const calendarId = deleteCalendarId;
    setErrorMsg("");
    setSuccessMsg("");
    setDeleteCalendarId(null);

    try {
      setSaving(true);

      if (!hasAccessToken()) {
        setErrorMsg("로그인 정보가 없습니다.");
        return;
      }

      const result = await deleteMyCalendar(calendarId);
      if (!result.ok) {
        setErrorMsg(result.message ?? "캘린더 삭제 중 오류가 발생했습니다.");
        return;
      }

      setSuccessMsg("캘린더가 삭제되었습니다.");
      await loadCalendarInfo();
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "캘린더 삭제 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  };

  // 캘린더 초대 팝업 열기
  const handleInvitation = (calendarId: number, calendarName: string, isOwner: boolean) => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!isOwner) {
      setErrorMsg("캘린더 초대는 캘린더장만 가능합니다.");
      return;
    }

    setInviteCalendarId(calendarId);
    setInviteCalendarName(calendarName);
    setInviteOpen(true);
  };

  // 캘린더 회원 목록 열기/닫기와 최초 회원 정보 조회
  const handleToggleMembers = async (calendarId: number) => {
    setErrorMsg("");
    setSuccessMsg("");

    if (openMemberCalendarId === calendarId) {
      setOpenMemberCalendarId(null);
      return;
    }

    setOpenMemberCalendarId(calendarId);
    setMemberPageMap((prev) => ({ ...prev, [calendarId]: prev[calendarId] ?? 1 }));
    if (memberMap[calendarId]) return;

    try {
      setMemberLoadingMap((prev) => ({ ...prev, [calendarId]: true }));

      if (!hasAccessToken()) {
        setErrorMsg("로그인 정보가 없습니다.");
        return;
      }

      const result = await getCalendarDetail(calendarId);
      if (!result.ok) {
        setErrorMsg("회원 목록을 불러오지 못했습니다.");
        return;
      }

      setMemberMap((prev) => ({ ...prev, [calendarId]: result.members ?? [] }));
    } catch (err) {
      console.error(err);
      setErrorMsg("회원 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setMemberLoadingMap((prev) => ({ ...prev, [calendarId]: false }));
    }
  };

  // 펼쳐진 회원 목록 페이지 변경
  const handleMemberPageChange = (calendarId: number, page: number) => {
    setMemberPageMap((prev) => ({ ...prev, [calendarId]: page }));
  };

  if (loading) {
    return (
      <div className={styles.pageStateBox}>
        <FamilyLoader label="캘린더 정보 로딩 중" />
      </div>
    );
  }

  if (errorMsg && !data) {
    return <div className={styles.pageStateBoxError}>{errorMsg}</div>;
  }

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <div className={styles.sectionTitle}>캘린더 정보</div>

          <button
            type="button"
            className={styles.addCalendarButton}
            onClick={handleAddCalendarRow}
            disabled={addingCalendar}
          >
            + 캘린더 추가
          </button>
        </div>

        <button type="button" className={styles.saveButton} onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {errorMsg && <div className={styles.errorText}>{errorMsg}</div>}
      {successMsg && <div className={styles.successText}>{successMsg}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: "4%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "57%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>

          <thead>
            <tr>
              <th>순서</th>
              <th>메인</th>
              <th>캘린더명</th>
              <th>구분</th>
              <th colSpan={2}>관리</th>
              <th>회원정보</th>
            </tr>
          </thead>

          <tbody>
            {data?.calendars && data.calendars.length > 0 ? (
              getSortedCalendars().map((calendar, index) => {
                const isOwner = calendar.owner_id === calendar.user_id;
                const ownerText = isOwner ? "캘린더장" : "일반회원";
                const isChecked = selectedCalendarId === calendar.id;

                return (
                  <Fragment key={calendar.id}>
                    <tr>
                      <td>
                        <div className={styles.orderButtonBox}>
                          <button
                            type="button"
                            className={styles.orderButton}
                            onClick={() => handleMoveCalendar(calendar.id, "up")}
                            disabled={saving || index === 0}
                          >
                            ▲
                          </button>

                          <button
                            type="button"
                            className={styles.orderButton}
                            onClick={() => handleMoveCalendar(calendar.id, "down")}
                            disabled={saving || index === getSortedCalendars().length - 1}
                          >
                            ▼
                          </button>
                        </div>
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          className={styles.tableInputCheck}
                          checked={isChecked}
                          onChange={() => handleCheckChange(calendar.id)}
                        />
                      </td>

                      <td>
                        <TableInput
                          type="text"
                          value={calendarNames[calendar.id] ?? ""}
                          readOnly={!isOwner}
                          onChange={(e) => handleCalendarNameChange(calendar.id, isOwner, e.target.value)}
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>{ownerText}</td>

                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          className={`${styles.tableActionButton} ${styles.inviteButton}`}
                          onClick={() =>
                            handleInvitation(
                              calendar.id,
                              calendarNames[calendar.id] ?? calendar.name,
                              isOwner
                            )
                          }
                          disabled={saving}
                        >
                          초대
                        </button>
                      </td>

                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          className={`${styles.tableActionButton} ${styles.deleteButton}`}
                          onClick={() => handleDeleteClick(calendar.id)}
                          disabled={saving}
                        >
                          삭제
                        </button>
                      </td>

                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          className={`${styles.memberToggleButton} ${
                            openMemberCalendarId === calendar.id ? styles.memberToggleOpen : ""
                          }`}
                          onClick={() => handleToggleMembers(calendar.id)}
                          aria-label={
                            openMemberCalendarId === calendar.id ? "회원정보 접기" : "회원정보 자세히 보기"
                          }
                          title={openMemberCalendarId === calendar.id ? "회원정보 접기" : "회원정보 자세히 보기"}
                        >
                          <span>{openMemberCalendarId === calendar.id ? "접기" : "자세히"}</span>
                          <span
                            className={`${styles.memberToggleArrow} ${
                              openMemberCalendarId === calendar.id ? styles.memberToggleArrowOpen : ""
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      </td>
                    </tr>

                    <tr className={styles.memberDetailRow}>
                      <td colSpan={7}>
                        <div
                          className={`${styles.memberSlideBox} ${
                            openMemberCalendarId === calendar.id ? styles.memberSlideBoxOpen : ""
                          }`}
                        >
                          {memberLoadingMap[calendar.id] ? (
                            <div className={styles.memberLoading}>
                              <FamilyLoader label="회원 목록 로딩 중" />
                            </div>
                          ) : (
                            (() => {
                              const members = memberMap[calendar.id] ?? [];
                              const currentPage = memberPageMap[calendar.id] ?? 1;
                              const pageSize = 5;
                              const totalPage = Math.max(1, Math.ceil(members.length / pageSize));
                              const startIndex = (currentPage - 1) * pageSize;
                              const visibleMembers = members.slice(startIndex, startIndex + pageSize);
                              const totalMemberCount = visibleMembers[0]?.total_count ?? members.length;

                              return (
                                <div className={styles.memberContent}>
                                  <div className={styles.totalMembers}>전체 회원 수: {totalMemberCount}명</div>
                                  <table className={styles.memberTable}>
                                    <thead>
                                      <tr>
                                        <th>번호</th>
                                        <th>구분</th>
                                        <th>이름</th>
                                        <th>이메일</th>
                                        <th>가입일</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {visibleMembers.length > 0 ? (
                                        visibleMembers.map((member) => (
                                          <tr key={member.user_id}>
                                            <td>{member.no}</td>
                                            <td>{member.role === "owner" ? "캘린더장" : "일반회원"}</td>
                                            <td>{member.name}</td>
                                            <td>{member.email}</td>
                                            <td>{member.joined_at}</td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={5}>회원 정보가 없습니다.</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>

                                  <div className={styles.memberPaging}>
                                    <button
                                      type="button"
                                      disabled={currentPage <= 1}
                                      onClick={() => handleMemberPageChange(calendar.id, currentPage - 1)}
                                    >
                                      이전
                                    </button>

                                    <span>
                                      {currentPage} / {totalPage}
                                    </span>

                                    <button
                                      type="button"
                                      disabled={currentPage >= totalPage}
                                      onClick={() => handleMemberPageChange(calendar.id, currentPage + 1)}
                                    >
                                      다음
                                    </button>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className={styles.emptyRow}>
                  조회된 캘린더가 없습니다.
                </td>
              </tr>
            )}

            {addingCalendar && (
              <tr>
                <td>
                  <div className={styles.orderButtonBox}>
                    <button type="button" className={styles.orderButton} disabled>
                      ▲
                    </button>
                    <button type="button" className={styles.orderButton} disabled>
                      ▼
                    </button>
                  </div>
                </td>

                <td>
                  <input
                    type="checkbox"
                    className={styles.tableInputCheck}
                    checked={newCalendarMain}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNewCalendarMain(checked);
                      if (checked) setSelectedCalendarId(null);
                    }}
                  />
                </td>

                <td>
                  <TableInput
                    type="text"
                    value={newCalendarName}
                    placeholder="새 캘린더명"
                    onChange={(e) => setNewCalendarName(e.target.value)}
                  />
                </td>

                <td className={styles.roleCell}>{newCalendarMain ? "캘린더장" : "일반회원"}</td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={`${styles.tableActionButton} ${styles.inviteButton}`}
                    disabled={saving}
                  >
                    초대
                  </button>
                </td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={`${styles.tableActionButton} ${styles.deleteButton}`}
                    onClick={() => {
                      setAddingCalendar(false);
                      setNewCalendarName("");
                      setNewCalendarMain(false);
                    }}
                  >
                    취소
                  </button>
                </td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CalendarInvitePopup
        open={inviteOpen}
        calendarId={inviteCalendarId}
        calendarName={inviteCalendarName}
        onClose={() => setInviteOpen(false)}
      />

      <ConfirmDialog
        open={deleteCalendarId != null}
        title="삭제 확인"
        message="해당 캘린더를 삭제하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDeleteCalendarId(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
