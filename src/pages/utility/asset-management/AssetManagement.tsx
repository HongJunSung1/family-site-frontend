import { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useMobileHeader } from "../../../common/mobile-header";
import { getMyCalendars, type MyCalendar } from "../../../api/calendarApi";
import AssetAccountManagement from "./accounts/AssetAccountManagement";
import AssetReferenceManagement from "./reference/AssetReferenceManagement";
import MonthlyAssetInput from "./monthly/MonthlyAssetInput";
import AssetOverview from "./overview/AssetOverview";
import styles from "./AssetManagement.module.css";


const INTERNAL_ROUTES = {
  overview: "/asset-management/overview",
  monthly: "/asset-management/monthly",
  accounts: "/asset-management/accounts",
  reference: "/asset-management/reference",
} as const;

// 자산관리 하위 경로에 맞는 현재 화면 제목 반환
function getCurrentTitle(pathname: string) {
  if (pathname.startsWith(INTERNAL_ROUTES.monthly)) return "월별 재산 입력";
  if (pathname.startsWith(INTERNAL_ROUTES.accounts)) return "자산 계정 관리";
  if (pathname.startsWith(INTERNAL_ROUTES.reference)) return "기준 정보 관리";
  return "자산현황";
}

// 자산관리 내부 라우팅과 PC·모바일 메뉴 구성
export default function AssetManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setConfig, resetConfig } = useMobileHeader();
  const currentTitle = getCurrentTitle(location.pathname);
  const [calendars, setCalendars] = useState<MyCalendar[]>([]);
  const [calendarId, setCalendarId] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    location.pathname.startsWith(INTERNAL_ROUTES.accounts)
      || location.pathname.startsWith(INTERNAL_ROUTES.reference),
  );

  const mobileMenuItems = useMemo(
    () => [
      {
        id: "asset-overview",
        label: "자산현황",
        active: location.pathname.startsWith(INTERNAL_ROUTES.overview),
        onSelect: () => navigate(INTERNAL_ROUTES.overview),
      },
      {
        id: "asset-monthly",
        label: "월별 재산 입력",
        active: location.pathname.startsWith(INTERNAL_ROUTES.monthly),
        onSelect: () => navigate(INTERNAL_ROUTES.monthly),
      },
      {
        id: "asset-settings",
        label: "환경설정",
        active:
          location.pathname.startsWith(INTERNAL_ROUTES.accounts) ||
          location.pathname.startsWith(INTERNAL_ROUTES.reference),
        children: [
          {
            id: "asset-accounts",
            label: "자산 계정 관리",
            active: location.pathname.startsWith(INTERNAL_ROUTES.accounts),
            onSelect: () => {
              setIsSettingsOpen(true);
              navigate(INTERNAL_ROUTES.accounts);
            },
          },
          {
            id: "asset-reference",
            label: "기준 정보 관리",
            active: location.pathname.startsWith(INTERNAL_ROUTES.reference),
            onSelect: () => {
              setIsSettingsOpen(true);
              navigate(INTERNAL_ROUTES.reference);
            },
          },
        ],
      },
    ],
    [location.pathname, navigate],
  );

  useEffect(() => {
    setConfig({ title: currentTitle, menuItems: mobileMenuItems });
    return resetConfig;
  }, [currentTitle, mobileMenuItems, resetConfig, setConfig]);

  useEffect(() => {
    void getMyCalendars().then((items) => {
      setCalendars(items);
      setCalendarId((current) => current || items.find((item) => item.isDefault)?.calendarId || items[0]?.calendarId || 0);
    });
  }, []);

  const selectedCalendar = calendars.find((calendar) => calendar.calendarId === calendarId);
  const calendarControl = (
    <label className={styles.calendarControl}>
      <span>캘린더</span>
      <select
        value={calendarId}
        onChange={(event) => setCalendarId(Number(event.target.value))}
      >
        {calendars.map((calendar) => (
          <option key={calendar.calendarId} value={calendar.calendarId}>
            {calendar.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <nav className={styles.sideNav} aria-label="자산관리 메뉴">
          <strong className={styles.sideNavTitle}>자산관리</strong>
          <NavItem to={INTERNAL_ROUTES.overview}>자산현황</NavItem>
          <NavItem to={INTERNAL_ROUTES.monthly}>월별 재산 입력</NavItem>
          <button
            type="button"
            className={[
              styles.sideNavGroup,
              styles.sideNavGroupButton,
              location.pathname.startsWith(INTERNAL_ROUTES.accounts)
                || location.pathname.startsWith(INTERNAL_ROUTES.reference)
                ? styles.sideNavGroupActive
                : "",
            ].filter(Boolean).join(" ")}
            aria-expanded={isSettingsOpen}
            aria-controls="asset-settings-menu"
            onClick={() => setIsSettingsOpen((current) => !current)}
          >
            <span>환경설정</span>
            <span
              className={[
                styles.sideNavArrow,
                isSettingsOpen ? styles.sideNavArrowOpen : "",
              ].filter(Boolean).join(" ")}
              aria-hidden="true"
            >
              ›
            </span>
          </button>
          <div
            id="asset-settings-menu"
            className={[
              styles.sideNavSubMenu,
              isSettingsOpen ? styles.sideNavSubMenuOpen : "",
            ].filter(Boolean).join(" ")}
          >
            <NavItem to={INTERNAL_ROUTES.accounts} nested>
              자산 계정 관리
            </NavItem>
            <NavItem to={INTERNAL_ROUTES.reference} nested>
              기준 정보 관리
            </NavItem>
          </div>
        </nav>

        <div className={styles.content}>
          {!calendarId && (
            <div className={styles.calendarToolbar}>{calendarControl}</div>
          )}
          <Routes>
            <Route index element={<Navigate to="overview" replace />} />
            <Route
              path="overview"
              element={calendarId ? (
                <AssetOverview
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? "선택 캘린더"}
                  calendarControl={calendarControl}
                />
              ) : (
                <PendingAssetSection title="자산현황" />
              )}
            />
            <Route
              path="monthly"
              element={calendarId ? (
                <MonthlyAssetInput
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? "선택 캘린더"}
                  calendarControl={calendarControl}
                />
              ) : (
                <PendingAssetSection title="월별 자산 입력" />
              )}
            />
            <Route
              path="accounts"
              element={calendarId ? (
                <AssetAccountManagement
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? "선택 캘린더"}
                  calendarControl={calendarControl}
                />
              ) : (
                <PendingAssetSection title="자산 계정 관리" />
              )}
            />
            <Route
              path="reference"
              element={calendarId ? (
                <AssetReferenceManagement
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? "선택 캘린더"}
                  calendarControl={calendarControl}
                />
              ) : (
                <PendingAssetSection title="기준 정보 관리" />
              )}
            />
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Routes>
        </div>
      </div>
    </main>
  );
}

type NavItemProps = {
  to: string;
  children: string;
  nested?: boolean;
};

// PC 자산관리 내부 메뉴 링크
function NavItem({ to, children, nested = false }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [styles.sideNavItem, nested ? styles.sideNavItemNested : "", isActive ? styles.sideNavItemActive : ""]
          .filter(Boolean)
          .join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

// 이후 단계에서 실제 기능을 연결할 자산관리 하위 화면
function PendingAssetSection({ title }: { title: string }) {
  return (
    <section className={styles.screen}>
      <header className={styles.screenHeader}>
        <div>
          <h1>{title}</h1>
          <p>다음 개발 단계에서 구현합니다.</p>
        </div>
      </header>
    </section>
  );
}
