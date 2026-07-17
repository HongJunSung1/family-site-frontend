import { useEffect, useState } from "react";
import { hasAccessToken } from "../../../../api/client";
import {
  inviteCalendarUsers,
  searchCalendarInviteUsers,
  type InviteSearchUser,
} from "../../../../api/calendarApi";
import { Input } from "../../../../common/input";
import styles from "./CalendarInvitePopup.module.css";

// 알 수 없는 API 예외에서 사용자 안내 문구 추출
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

type Props = {
  open: boolean;
  calendarId: number | null;
  calendarName: string;
  onClose: () => void;
};

// 캘린더 초대 회원 검색과 초대장 발송
export default function CalendarInvitePopup({ open, calendarId, calendarName, onClose }: Props) {
  const [keyword, setKeyword] = useState("");
  const [users, setUsers] = useState<InviteSearchUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // 팝업 닫힘 시 검색어, 검색 결과, 선택 상태 초기화
  useEffect(() => {
    if (!open) {
      setKeyword("");
      setUsers([]);
      setSelectedIds([]);
      setMessage("");
      setErrorMsg("");
      setLoading(false);
      setSending(false);
    }
  }, [open]);

  if (!open) return null;

  const token = hasAccessToken();

  // 아이디/이메일 기준 초대 가능 회원 검색
  const handleSearch = async () => {
    setMessage("");
    setErrorMsg("");
    setSelectedIds([]);

    const trimmed = keyword.trim();

    if (!trimmed) {
      setErrorMsg("검색어를 입력해주세요.");
      return;
    }

    if (!calendarId) {
      setErrorMsg("캘린더 정보가 올바르지 않습니다.");
      return;
    }

    if (!token) {
      setErrorMsg("로그인 정보가 없습니다.");
      return;
    }

    try {
      setLoading(true);

      const result = await searchCalendarInviteUsers(calendarId, trimmed);

      if (!result.ok) {
        setErrorMsg(result.message ?? "회원 검색 중 오류가 발생했습니다.");
        return;
      }

      setUsers(result.users ?? []);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "회원 검색 중 오류가 발생했습니다."));
    } finally {
      setLoading(false);
    }
  };

  // 검색 결과 테이블의 초대 회원 선택 상태 갱신
  const handleCheck = (userId: number, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(userId)) return prev;
        return [...prev, userId];
      }

      return prev.filter((id) => id !== userId);
    });
  };

  // 선택 회원 대상 캘린더 초대장 발송
  const handleInvite = async () => {
    setMessage("");
    setErrorMsg("");

    if (!calendarId) {
      setErrorMsg("캘린더 정보가 올바르지 않습니다.");
      return;
    }

    if (selectedIds.length === 0) {
      setErrorMsg("초대할 회원을 선택해주세요.");
      return;
    }

    if (!token) {
      setErrorMsg("로그인 정보가 없습니다.");
      return;
    }

    try {
      setSending(true);

      const result = await inviteCalendarUsers(calendarId, selectedIds);

      if (!result.ok) {
        setErrorMsg(result.message ?? "초대 중 오류가 발생했습니다.");
        return;
      }

      setMessage(result.message ?? "초대장을 보냈습니다.");
      setSelectedIds([]);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "초대 중 오류가 발생했습니다."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.popup}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>캘린더 초대</div>
            <div className={styles.subtitle}>{calendarName}</div>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className={styles.searchRow}>
          <Input
            type="text"
            value={keyword}
            placeholder="초대할 회원 아이디 또는 이메일"
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />

          <button type="button" onClick={handleSearch} disabled={loading}>
            {loading ? "검색 중..." : "검색"}
          </button>
        </div>

        {errorMsg && <div className={styles.errorText}>{errorMsg}</div>}
        {message && <div className={styles.successText}>{message}</div>}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>선택</th>
                <th>회원 이름</th>
                <th>이메일</th>
              </tr>
            </thead>

            <tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={(e) => handleCheck(user.id, e.target.checked)}
                      />
                    </td>
                    <td>{user.name || user.login_id}</td>
                    <td>{user.email}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className={styles.emptyRow}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            취소
          </button>

          <button
            type="button"
            className={styles.inviteButton}
            onClick={handleInvite}
            disabled={sending}
          >
            {sending ? "초대 중..." : "초대하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
