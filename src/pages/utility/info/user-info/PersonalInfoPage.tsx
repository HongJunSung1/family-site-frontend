import { useState } from "react";
import styles from "./PersonalInfoPage.module.css";
import BasicPersonalInfo from "./BasicPersonalInfo";
import CalendarInfo from "../calendar-info/CalendarInfo";
import AlarmList from "../AlarmList/AlarmList";

type MenuKey = "basic" | "calendar" | "AlarmList";

export default function PersonalInfoPage() {
  const [selectedMenu, setSelectedMenu] = useState<MenuKey>("basic");

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
              className={`${styles.treeItem} ${
                selectedMenu === "basic" ? styles.active : ""
              }`}
              onClick={() => setSelectedMenu("basic")}
            >
              1) 기본 개인정보
            </button>

            <button
              type="button"
              className={`${styles.treeItem} ${
                selectedMenu === "calendar" ? styles.active : ""
              }`}
              onClick={() => setSelectedMenu("calendar")}
            >
              2) 캘린더 정보
            </button>

            <button
              type="button"
              className={`${styles.treeItem} ${
                selectedMenu === "AlarmList" ? styles.active : ""
              }`}
              onClick={() => setSelectedMenu("AlarmList")}
            >
              3) 받은 알람
            </button>
          </div>
        </aside>

        <section className={styles.content}>
          {selectedMenu === "basic" && <BasicPersonalInfo />}
          {selectedMenu === "calendar" && <CalendarInfo />}
          {selectedMenu === "AlarmList" && <AlarmList />}
        </section>
      </div>
    </div>
  );
}