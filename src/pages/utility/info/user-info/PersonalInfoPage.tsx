import { useState } from "react";
import AlarmList from "../AlarmList/AlarmList";
import { useNavigate } from "react-router-dom";
import { logoutAndClearSession } from "../../../../api/authApi";
import CalendarInfo from "../calendar-info/CalendarInfo";
import CalendarSettings from "../calendar-info/CalendarSettings";
import BasicPersonalInfo from "./BasicPersonalInfo";
import styles from "./PersonalInfoPage.module.css";

type MenuKey = "basic" | "calendarList" | "calendarSettings" | "AlarmList";

type Props = {
  onLogout: () => void;
};

export default function PersonalInfoPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const [selectedMenu, setSelectedMenu] = useState<MenuKey>("basic");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const onClickCalendarGroup = () => {
    setIsCalendarOpen((prev) => !prev);
  };

  const handleLogout = async () => {
    try {
      await logoutAndClearSession();
    } finally {
      onLogout();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>개인정보</h2>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.treeChildren}>
            <button
              type="button"
              className={`${styles.treeItem} ${selectedMenu === "basic" ? styles.active : ""}`}
              onClick={() => setSelectedMenu("basic")}
            >
              1) 기본 개인정보
            </button>

            <button
              type="button"
              className={`${styles.treeItem} ${styles.treeParent} ${
                selectedMenu === "calendarList" || selectedMenu === "calendarSettings"
                  ? styles.active
                  : ""
              }`}
              onClick={onClickCalendarGroup}
            >
              <span>2) 캘린더 정보</span>
              <span className={styles.treeArrow}>{isCalendarOpen ? "∧" : "∨"}</span>
            </button>

            <div className={`${styles.treeSubMenu} ${isCalendarOpen ? styles.treeSubMenuOpen : ""}`}>
              <button
                type="button"
                className={`${styles.treeItem} ${styles.subTreeItem} ${
                  selectedMenu === "calendarList" ? styles.active : ""
                }`}
                onClick={() => setSelectedMenu("calendarList")}
              >
                · 캘린더 리스트
              </button>

              <button
                type="button"
                className={`${styles.treeItem} ${styles.subTreeItem} ${
                  selectedMenu === "calendarSettings" ? styles.active : ""
                }`}
                onClick={() => setSelectedMenu("calendarSettings")}
              >
                · 캘린더 환경설정
              </button>
            </div>

            <button
              type="button"
              className={`${styles.treeItem} ${selectedMenu === "AlarmList" ? styles.active : ""}`}
              onClick={() => setSelectedMenu("AlarmList")}
            >
              3) 받은 알림
            </button>
          </div>

          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            로그아웃
          </button>
        </aside>

        <section className={styles.content}>
          {selectedMenu === "basic" && <BasicPersonalInfo />}
          {selectedMenu === "calendarList" && <CalendarInfo />}
          {selectedMenu === "calendarSettings" && <CalendarSettings />}
          {selectedMenu === "AlarmList" && <AlarmList />}
        </section>
      </div>
    </div>
  );
}
