import { useEffect, useRef, useState } from "react";
import { hasAccessToken } from "../../../api/client";
import {
  getNotifications,
  markNotificationRead,
  respondCalendarInvitation,
  type NotificationItem,
} from "../../../api/notificationApi";
import { AlertDialog } from "../../../common/dialog";
import notificationBellIcon from "../../../assets/icons/notification-bell.svg";
import styles from "./NotificationBell.module.css";

type NotificationBellProps = {
  placement?: "top" | "bottom";
};

export default function NotificationBell({ placement = "top" }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = async () => {
    if (!hasAccessToken()) return;

    try {
      setLoading(true);

      const result = await getNotifications();

      setNotifications(result.notifications ?? []);
      setUnreadCount(result.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (notificationId: number) => {
    if (!hasAccessToken()) return;

    await markNotificationRead(notificationId);

    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, is_read: 1 } : item))
    );

    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const respondInvite = async (notification: NotificationItem, action: "accept" | "reject") => {
    if (!hasAccessToken() || !notification.ref_id) return;

    const result = await respondCalendarInvitation(notification.ref_id, action);

    if (!result.ok) {
      setAlertMessage(result.message ?? "처리 중 오류가 발생했습니다.");
      return;
    }

    await loadNotifications();
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBellClick = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      await loadNotifications();
    }
  };

  return (
    <div
      className={[styles.wrap, placement === "bottom" ? styles.bottomWrap : ""]
        .filter(Boolean)
        .join(" ")}
      ref={wrapRef}
    >
      <button
        type="button"
        className={styles.bellButton}
        onClick={handleBellClick}
        aria-label="알림"
        title="알림"
      >
        <img src={notificationBellIcon} alt="" className={styles.bellIconImage} aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <strong>알림</strong>
            <button type="button" onClick={loadNotifications}>
              새로고침
            </button>
          </div>

          {loading && <div className={styles.empty}>알림을 불러오는 중...</div>}

          {!loading && notifications.length === 0 && (
            <div className={styles.empty}>알림이 없습니다.</div>
          )}

          {!loading &&
            notifications.map((item) => (
              <div
                key={item.id}
                className={`${styles.item} ${item.is_read === 0 ? styles.unread : ""}`}
                onClick={() => {
                  if (item.is_read === 0) markRead(item.id);
                }}
              >
                <div className={styles.itemTitle}>{item.title}</div>
                <div className={styles.itemMessage}>{item.message}</div>

                {item.type === "calendar_invite" && (
                  <div className={styles.actionRow}>
                    <button
                      type="button"
                      className={styles.acceptButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        respondInvite(item, "accept");
                      }}
                    >
                      수락
                    </button>

                    <button
                      type="button"
                      className={styles.rejectButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        respondInvite(item, "reject");
                      }}
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      <AlertDialog
        open={!!alertMessage}
        title="안내"
        message={alertMessage}
        onClose={() => setAlertMessage("")}
      />
    </div>
  );
}
