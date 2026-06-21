// 캘린더정보

import { Fragment, useEffect, useState } from "react";
import styles from "./CalendarInfo.module.css";
import CalendarInvitePopup from "./CalendarInvitePopup";

const API_BASE = import.meta.env.VITE_API_URL || "";

type CalendarInfoItem = {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  user_id: number;
  role: string;
  tab_order: number | null;
};

type CalendarMemberItem = {
  no: number;
  user_id: number;
  role: string;
  joined_at: string;
  name: string;
  email: string;
  total_count: number;
};

type CalendarDetailResponse = {
  ok: boolean;
  calendar: {
    id: number;
    name: string;
    owner_id: number;
    created_at: string;
  };
  members: CalendarMemberItem[];
};
type GetMyCalendarsInfoResponse = {
  ok: boolean;
  calendars: CalendarInfoItem[];
  defaultCalendarId: number | null;
};

type SaveMyCalendarsInfoResponse = {
  ok: boolean;
  message?: string;
};

type DeleteMyCalendarResponse = {
  ok: boolean;
  message?: string;
  deletedCalendarId?: number;
  nextDefaultCalendarId?: number | null;
};

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

  // 초대하기 팝업창
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCalendarId, setInviteCalendarId] = useState<number | null>(null);
  const [inviteCalendarName, setInviteCalendarName] = useState("");

  // 회원 명단 보여주기
  const [openMemberCalendarId, setOpenMemberCalendarId] = useState<number | null>(null);
  const [memberMap, setMemberMap] = useState<Record<number, CalendarMemberItem[]>>({});
  const [memberPageMap, setMemberPageMap] = useState<Record<number, number>>({});
  const [memberLoadingMap, setMemberLoadingMap] = useState<Record<number, boolean>>({});

  const loadCalendarInfo = async () => {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      setErrorMsg("로그인 정보가 없습니다.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/calendars/getMyCalendarsInfo`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await res.json()) as GetMyCalendarsInfoResponse;
      if (!res.ok || !result.ok) {
        setErrorMsg("캘린더 정보를 불러오지 못했습니다.");
        return;
      }

      setData(result);
      setSelectedCalendarId(result.defaultCalendarId ?? null);

      const initialTabOrders: Record<number, string> = {};
      const initialNames: Record<number, string> = {};

      for (const calendar of result.calendars) {
        initialNames[calendar.id] = calendar.name;

        if (result.defaultCalendarId === calendar.id) {
          initialTabOrders[calendar.id] = "0";
        } else {
          initialTabOrders[calendar.id] =
            calendar.tab_order === null || calendar.tab_order === undefined
              ? ""
              : String(calendar.tab_order);
        }
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

  const getSortedCalendars = () => {
    if (!data?.calendars) return [];

    return [...data.calendars].sort((a, b) => {
      const aOrder =
        selectedCalendarId === a.id ? 0 : Number(tabOrders[a.id] ?? a.tab_order ?? 999999);
      const bOrder =
        selectedCalendarId === b.id ? 0 : Number(tabOrders[b.id] ?? b.tab_order ?? 999999);

      return aOrder - bOrder;
    });
  };

  const saveCalendarOrderImmediately = async (
    orderedCalendarIds: number[],
    nextDefaultCalendarId: number | null
  ) => {
    if (!data) return;

    setErrorMsg("");
    setSuccessMsg("");
    setSaving(true);

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setErrorMsg("로그인 정보가 없습니다.");
        return;
      }

      const calendarsPayload = orderedCalendarIds.map((calendarId, index) => {
        const calendar = data.calendars.find((item) => item.id === calendarId);
        if (!calendar) {
          throw new Error("캘린더 정보를 찾을 수 없습니다.");
        }

        return {
          calendarId,
          name: (calendarNames[calendarId] ?? calendar.name).trim(),
          tabOrder: index,
        };
      });

      const res = await fetch(`${API_BASE}/api/calendars/saveMyCalendarsInfo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          defaultCalendarId: nextDefaultCalendarId,
          newCalendarMain: false,
          calendars: calendarsPayload,
        }),
      });

      const result = (await res.json()) as SaveMyCalendarsInfoResponse;

      if (!res.ok || !result.ok) {
        setErrorMsg(result.message ?? "순서 저장 중 오류가 발생했습니다.");
        return;
      }

      await loadCalendarInfo();
      setSuccessMsg("순서가 변경되었습니다.");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "순서 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

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

    const orderedCalendarIds = next.map((item) => item.id);

    await saveCalendarOrderImmediately(orderedCalendarIds, selectedCalendarId);
  };


  const handleCheckChange = async (calendarId: number) => {
    if (!data || saving) return;

    setErrorMsg("");
    setSuccessMsg("");

    setNewCalendarMain(false);
    setSelectedCalendarId(calendarId);

    const sorted = getSortedCalendars();
    const selected = sorted.find((item) => item.id === calendarId);
    const others = sorted.filter((item) => item.id !== calendarId);

    if (!selected) return;

    const orderedCalendarIds = [selected, ...others].map((item) => item.id);

    const nextOrders: Record<number, string> = {};
    orderedCalendarIds.forEach((id, index) => {
      nextOrders[id] = String(index);
    });

    setTabOrders(nextOrders);

    await saveCalendarOrderImmediately(orderedCalendarIds, calendarId);
  };



  const handleCalendarNameChange = (
    calendarId: number,
    ownerText: string,
    value: string
  ) => {
    setErrorMsg("");
    setSuccessMsg("");

    if (ownerText !== "캘린더장") {
      setErrorMsg("캘린더명은 캘린더장만 바꿀 수 있습니다.");
      return;
    }

    setCalendarNames((prev) => ({
      ...prev,
      [calendarId]: value,
    }));
  };

  const handleCalendarNameFocus = (ownerText: string) => {
    if (ownerText !== "캘린더장") {
      setErrorMsg("캘린더명은 캘린더장만 바꿀 수 있습니다.");
      setSuccessMsg("");
    }
  };

  // 캘린더 신규 저장
  const handleAddCalendarRow = () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (addingCalendar) return;

    setAddingCalendar(true);
    setNewCalendarName("");
    setNewCalendarMain(false);
  };

  const handleSave = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!data) return;

    try {
      const usedOrders = new Set<number>();

      const calendarsPayload = data.calendars.map((calendar) => {
        const rawName = (calendarNames[calendar.id] ?? "").trim();

        if (!rawName) {
          throw new Error("캘린더명은 비워둘 수 없습니다.");
        }

        let rawValue = tabOrders[calendar.id] ?? "";

        if (selectedCalendarId === calendar.id) {
          rawValue = "0";
        }

        if (rawValue === "") {
          return {
            calendarId: calendar.id,
            name: rawName,
            tabOrder: null,
          };
        }

        const num = Number(rawValue);

        if (!Number.isInteger(num)) {
          throw new Error("탭 순서는 정수만 입력할 수 있습니다.");
        }

        if (num < 0) {
          throw new Error("탭 순서는 0 또는 양의 정수만 가능합니다.");
        }

        if (usedOrders.has(num)) {
          throw new Error("메인 캘린더보다 앞선 순서로 지정할 수 없습니다.");
        }

        usedOrders.add(num);

        return {
          calendarId: calendar.id,
          name: rawName,
          tabOrder: num,
        };
      });

      if (addingCalendar) {
        const trimmedNewName = newCalendarName.trim();

        if (!trimmedNewName) {
          throw new Error("새 캘린더명을 입력해주세요.");
        }

        if (newCalendarMain) {
          calendarsPayload.forEach((item) => {
            item.tabOrder = item.tabOrder === null ? null : item.tabOrder + 1;
          });

          calendarsPayload.push({
            calendarId: 0,
            name: trimmedNewName,
            tabOrder: 0,
          });
        } else {
          const maxOrder =
            calendarsPayload.length === 0
              ? -1
              : Math.max(
                  ...calendarsPayload.map((item) =>
                    item.tabOrder === null ? -1 : item.tabOrder
                  )
                );

          calendarsPayload.push({
            calendarId: 0,
            name: trimmedNewName,
            tabOrder: maxOrder + 1,
          });
        }
      }


      setSaving(true);

      const token = localStorage.getItem("accessToken");
      if (!token) {
        setErrorMsg("로그인 정보가 없습니다.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/calendars/saveMyCalendarsInfo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          defaultCalendarId: newCalendarMain ? null : selectedCalendarId,
          newCalendarMain,
          calendars: calendarsPayload,
        }),
      });

      const result = (await res.json()) as SaveMyCalendarsInfoResponse;

      if (!res.ok || !result.ok) {
        setErrorMsg(result.message ?? "저장 중 오류가 발생했습니다.");
        return;
      }

      setAddingCalendar(false);
      setNewCalendarName("");
      setNewCalendarMain(false);
      
      await loadCalendarInfo();
      setSuccessMsg("저장되었습니다.");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (calendarId: number) => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!window.confirm("해당 캘린더를 삭제하시겠습니까?")) {
      return;
    }

    try {
      setSaving(true);

      const token = localStorage.getItem("accessToken");
      if (!token) {
        setErrorMsg("로그인 정보가 없습니다.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/calendars/${calendarId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await res.json()) as DeleteMyCalendarResponse;

      if (!res.ok || !result.ok) {
        setErrorMsg(result.message ?? "캘린더 삭제 중 오류가 발생했습니다.");
        return;
      }

      setSuccessMsg("캘린더가 삭제되었습니다.");
      await loadCalendarInfo();
    } catch (err: any) {
      setErrorMsg(err?.message ?? "캘린더 삭제 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 캘린더초대
  const handleInvitation = (
    calendarId: number,
    calendarName: string,
    isOwner: boolean
  ) => {
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

  const handleToggleMembers = async (calendarId: number) => {
    setErrorMsg("");
    setSuccessMsg("");

    if (openMemberCalendarId === calendarId) {
      setOpenMemberCalendarId(null);
      return;
    }

    setOpenMemberCalendarId(calendarId);
    setMemberPageMap((prev) => ({
      ...prev,
      [calendarId]: prev[calendarId] ?? 1,
    }));

    if (memberMap[calendarId]) return;

    try {
      setMemberLoadingMap((prev) => ({
        ...prev,
        [calendarId]: true,
      }));

      const token = localStorage.getItem("accessToken");
      if (!token) {
        setErrorMsg("로그인 정보가 없습니다.");
        return;
      }

      const res = await fetch(
        `${API_BASE}/api/calendars/getCalendarDetail?calendarId=${calendarId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await res.json()) as CalendarDetailResponse;

      if (!res.ok || !result.ok) {
        setErrorMsg("회원 명단을 불러오지 못했습니다.");
        return;
      }

      setMemberMap((prev) => ({
        ...prev,
        [calendarId]: result.members ?? [],
      }));
    } catch (err) {
      console.error(err);
      setErrorMsg("회원 명단 조회 중 오류가 발생했습니다.");
    } finally {
      setMemberLoadingMap((prev) => ({
        ...prev,
        [calendarId]: false,
      }));
    }
  };

  const handleMemberPageChange = (calendarId: number, page: number) => {
    setMemberPageMap((prev) => ({
      ...prev,
      [calendarId]: page,
    }));
  };

  if (loading) {
    return (
      <div className={styles.pageStateBox}>
        캘린더 정보를 불러오는 중...
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className={styles.pageStateBoxError}>
        {errorMsg}
      </div>
    );
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
            + 캘린더추가
          </button>
        </div>

        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {errorMsg && <div className={styles.errorText}>{errorMsg}</div>}
      {successMsg && <div className={styles.successText}>{successMsg}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: "5%" }} />  {/* 순서이동 */}
            <col style={{ width: "5%" }} />  {/* 메인 */}
            <col style={{ width: "65%" }} /> {/* 캘린더명 */}
            <col style={{ width: "7%" }} />  {/* 구분 */}
            <col style={{ width: "7%" }} />  {/* 초대 */}
            <col style={{ width: "7%" }} />  {/* 삭제 */}
            <col style={{ width: "5%" }} /> {/* 회원정보 */}
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
                const ownerText =
                  calendar.owner_id === calendar.user_id
                    ? "캘린더장"
                    : "일반회원";

                const isChecked = selectedCalendarId === calendar.id;
                
                const isOwner = ownerText === "캘린더장";

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
                          className ={styles.tableInputCheck}
                          checked={isChecked}
                          onChange={() => handleCheckChange(calendar.id)}
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          className ={styles.tableInputText}
                          value={calendarNames[calendar.id] ?? ""}
                          readOnly={!isOwner}
                          onFocus={() => handleCalendarNameFocus(ownerText)}
                          onChange={(e) =>
                            handleCalendarNameChange(calendar.id, ownerText, e.target.value)
                          }
                        />
                      </td>

                      <td style={{textAlign: "center"}}>{ownerText}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.saveButton}
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

                      <td>
                        <button
                          type="button"
                          className={styles.saveButton}
                          onClick={() => handleDelete(calendar.id)}
                          disabled={saving}
                        >
                          삭제
                        </button>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={`${styles.memberToggleButton} ${
                            openMemberCalendarId === calendar.id ? styles.memberToggleOpen : ""
                          }`}
                          onClick={() => handleToggleMembers(calendar.id)}
                        >
                          ▼
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
                            <div className={styles.memberLoading}>회원 명단을 불러오는 중...</div>
                          ) : (
                            (() => {
                              const members = memberMap[calendar.id] ?? [];
                              const currentPage = memberPageMap[calendar.id] ?? 1;
                              const pageSize = 5;
                              const totalPage = Math.max(1, Math.ceil(members.length / pageSize));
                              const startIndex = (currentPage - 1) * pageSize;
                              const visibleMembers = members.slice(startIndex, startIndex + pageSize);
                              const totalCount = visibleMembers[0]?.total_count ?? 0;
                              return (
                                <div className={styles.memberContent}>
                                  <div className={styles.totalMembers}>전체 회원 수 : {totalCount}명</div>
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
                                            <td>
                                              {member.role === "owner" ? "캘린더장" : "일반회원"}
                                            </td>
                                            <td>{member.name}</td>
                                            <td>{member.email}</td>
                                            <td>{member.joined_at}</td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={4}>회원 정보가 없습니다.</td>
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
                <td colSpan={6} className={styles.emptyRow}>
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
                  className ={styles.tableInputCheck}
                  checked={newCalendarMain}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNewCalendarMain(checked);

                    if (checked) {
                      setSelectedCalendarId(null);
                    }
                  }}
                />
              </td>

              <td>
                <input
                  type="text"
                  value={newCalendarName}
                  className ={styles.tableInputText}
                  placeholder="새 캘린더명"
                  onChange={(e) => setNewCalendarName(e.target.value)}
                />
              </td>

              <td>캘린더장</td>

              <td>
                <button type="button" className={styles.saveButton} disabled={saving}>
                  초대
                </button>
              </td>

              <td>
                <button
                  type="button"
                  className={styles.saveButton}
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
    </div>
  );
}