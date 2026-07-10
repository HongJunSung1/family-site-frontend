import { useEffect, useState } from "react";
import { hasAccessToken } from "../../../../api/client";
import {
  getNotificationHistory,
  respondCalendarInvitation,
  type NotificationRow,
} from "../../../../api/notificationApi";
import { AlertDialog } from "../../../../common/dialog";
import { FamilyLoader } from "../../../../common/loading";
import styles from "./AlarmList.module.css";

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlarmList() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const fetchNotifications = async (targetPage: number) => {
    if (!hasAccessToken()) {
      setError("로그인이 필요합니다.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getNotificationHistory(targetPage);

      if (!data.ok) {
        throw new Error(data.message || "알림 목록을 불러오지 못했습니다.");
      }

      setNotifications(data.notifications ?? []);
      setPage(data.page);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림 목록 조회 중 오류가 발생했습니다.");
      setNotifications([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const respondInvite = async (notification: NotificationRow, action: "accept" | "reject") => {
    if (!hasAccessToken() || !notification.ref_id) return;

    const result = await respondCalendarInvitation(notification.ref_id, action);

    if (!result.ok) {
      setAlertMessage(result.message ?? "처리 중 오류가 발생했습니다.");
      return;
    }

    await fetchNotifications(page);
  };

  useEffect(() => {
    fetchNotifications(1);
  }, []);

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <div className={styles.sectionTitle}>받은 알림</div>
          <div className={styles.totalCount}>총 {totalCount}건</div>
        </div>
      </div>

      {error && <div className={styles.errorText}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "40%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "24%" }} />
          </colgroup>

          <thead>
            <tr>
              <th>번호</th>
              <th>제목</th>
              <th>내용</th>
              <th>상태</th>
              <th>받은 일시</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>
                  <FamilyLoader label="알림 목록 로딩 중" />
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>
                  조회된 알림이 없습니다.
                </td>
              </tr>
            ) : (
              notifications.map((row, index) => (
                <tr key={row.id}>
                  <td className={styles.center}>{totalCount - ((page - 1) * 10 + index)}</td>
                  <td>{row.title || "-"}</td>
                  <td>{row.message || "-"}</td>
                  <td className={styles.center}>
                    {row.type === "calendar_invite" ? (
                      row.invitation_status === "accepted" ? (
                        <span className={styles.acceptedText}>수락완료</span>
                      ) : row.invitation_status === "rejected" ? (
                        <span className={styles.rejectedText}>거절완료</span>
                      ) : row.status === "expired" ? (
                        <span className={styles.expiredText}>만료됨</span>
                      ) : row.invitation_status === "pending" ? (
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            className={styles.acceptButton}
                            onClick={() => respondInvite(row, "accept")}
                          >
                            수락
                          </button>

                          <button
                            type="button"
                            className={styles.rejectButton}
                            onClick={() => respondInvite(row, "reject")}
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        "-"
                      )
                    ) : row.is_read === 1 ? (
                      "읽음"
                    ) : (
                      "안 읽음"
                    )}
                  </td>
                  <td className={styles.center}>{formatDateTime(row.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.paging}>
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => fetchNotifications(page - 1)}
        >
          이전
        </button>

        <span>
          {page} / {totalPages}
        </span>

        <button
          type="button"
          disabled={loading || page >= totalPages}
          onClick={() => fetchNotifications(page + 1)}
        >
          다음
        </button>
      </div>

      <AlertDialog
        open={!!alertMessage}
        title="안내"
        message={alertMessage}
        onClose={() => setAlertMessage("")}
      />
    </div>
  );
}
