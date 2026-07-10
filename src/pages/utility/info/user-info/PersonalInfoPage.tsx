import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logoutAndClearSession } from "../../../../api/authApi";
import { useMobileHeader } from "../../../../common/components/MobileHeaderContext";
import AlarmList from "../AlarmList/AlarmList";
import CalendarInfo from "../calendar-info/CalendarInfo";
import CalendarSettings from "../calendar-info/CalendarSettings";
import BasicPersonalInfo from "./BasicPersonalInfo";
import styles from "./PersonalInfoPage.module.css";

type MenuKey = "basic" | "calendarList" | "calendarSettings" | "AlarmList";

type Props = {
  onLogout: () => void;
};

const MENU_LABELS: Record<MenuKey, string> = {
  basic: "기본 개인정보",
  calendarList: "캘린더 리스트",
  calendarSettings: "캘린더 환경설정",
  AlarmList: "받은 알림",
};

export default function PersonalInfoPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { setConfig: setMobileHeaderConfig, resetConfig: resetMobileHeaderConfig } = useMobileHeader();
  const [selectedMenu, setSelectedMenu] = useState<MenuKey>("basic");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const onClickCalendarGroup = () => {
    setIsCalendarOpen((prev) => !prev);
  };

  const selectMenu = useCallback((menu: MenuKey) => {
    setSelectedMenu(menu);
    if (menu === "calendarList" || menu === "calendarSettings") {
      setIsCalendarOpen(true);
    }
  }, []);

  const mobileMenuItems = useMemo(
    () => [
      {
        id: "basic",
        label: MENU_LABELS.basic,
        active: selectedMenu === "basic",
        onSelect: () => selectMenu("basic"),
      },
      {
        id: "calendar",
        label: "캘린더",
        active: selectedMenu === "calendarList" || selectedMenu === "calendarSettings",
        children: [
          {
            id: "calendarList",
            label: MENU_LABELS.calendarList,
            active: selectedMenu === "calendarList",
            onSelect: () => selectMenu("calendarList"),
          },
          {
            id: "calendarSettings",
            label: MENU_LABELS.calendarSettings,
            active: selectedMenu === "calendarSettings",
            onSelect: () => selectMenu("calendarSettings"),
          },
        ],
      },
      {
        id: "AlarmList",
        label: MENU_LABELS.AlarmList,
        active: selectedMenu === "AlarmList",
        onSelect: () => selectMenu("AlarmList"),
      },
    ],
    [selectMenu, selectedMenu]
  );

  useEffect(() => {
    setMobileHeaderConfig({
      title: MENU_LABELS[selectedMenu],
      menuItems: mobileMenuItems,
    });

    return () => {
      resetMobileHeaderConfig();
    };
  }, [mobileMenuItems, resetMobileHeaderConfig, selectedMenu, setMobileHeaderConfig]);

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
              onClick={() => selectMenu("basic")}
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
                onClick={() => selectMenu("calendarList")}
              >
                · 캘린더 리스트
              </button>

              <button
                type="button"
                className={`${styles.treeItem} ${styles.subTreeItem} ${
                  selectedMenu === "calendarSettings" ? styles.active : ""
                }`}
                onClick={() => selectMenu("calendarSettings")}
              >
                · 캘린더 환경설정
              </button>
            </div>

            <button
              type="button"
              className={`${styles.treeItem} ${selectedMenu === "AlarmList" ? styles.active : ""}`}
              onClick={() => selectMenu("AlarmList")}
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

          <button type="button" className={styles.mobileLogoutButton} onClick={handleLogout}>
            로그아웃
          </button>
        </section>
      </div>
    </div>
  );
}
