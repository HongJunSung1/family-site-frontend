import { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getMyCalendars, type MyCalendar } from "../../../api/calendarApi";
import { LoadingOverlay } from "../../../common/loading";
import { useMobileHeader } from "../../../common/mobile-header";
import LedgerOverview from "./overview/LedgerOverview";
import LedgerTransactions from "./transactions/LedgerTransactions";
import LedgerAccounts from "./settings/LedgerAccounts";
import LedgerCategories from "./settings/LedgerCategories";
import LedgerImportProfiles from "./settings/LedgerImportProfiles";
import styles from "./HouseholdAccounts.module.css";

const INTERNAL_ROUTES = {
  overview: "/household-accounts/overview",
  transactions: "/household-accounts/transactions",
  accounts: "/household-accounts/accounts",
  categories: "/household-accounts/categories",
  importProfiles: "/household-accounts/import-profiles",
} as const;

const SETTINGS_ROUTES = [
  INTERNAL_ROUTES.accounts,
  INTERNAL_ROUTES.categories,
  INTERNAL_ROUTES.importProfiles,
] as const;

function isSettingsRoute(pathname: string) {
  return SETTINGS_ROUTES.some((route) => pathname.startsWith(route));
}

// 현재 가계부 하위 경로에 해당하는 모바일 화면 제목 반환
function getCurrentTitle(pathname: string) {
  if (pathname.startsWith(INTERNAL_ROUTES.transactions)) return "거래내역";
  if (pathname.startsWith(INTERNAL_ROUTES.accounts)) return "계정 관리";
  if (pathname.startsWith(INTERNAL_ROUTES.categories)) return "분류 관리";
  if (pathname.startsWith(INTERNAL_ROUTES.importProfiles)) return "엑셀 가져오기 양식";
  return "가계부 현황";
}

// 가계부 내부 라우팅과 캘린더·PC·모바일 메뉴 구성
export default function HouseholdAccounts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setConfig, resetConfig } = useMobileHeader();
  const [calendars, setCalendars] = useState<MyCalendar[]>([]);
  const [calendarId, setCalendarId] = useState(0);
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsRoute(location.pathname));
  const currentTitle = getCurrentTitle(location.pathname);

  const mobileMenuItems = useMemo(
    () => [
      {
        id: "ledger-overview",
        label: "가계부 현황",
        active: location.pathname.startsWith(INTERNAL_ROUTES.overview),
        onSelect: () => navigate(INTERNAL_ROUTES.overview),
      },
      {
        id: "ledger-transactions",
        label: "거래내역",
        active: location.pathname.startsWith(INTERNAL_ROUTES.transactions),
        onSelect: () => navigate(INTERNAL_ROUTES.transactions),
      },
      {
        id: "ledger-settings",
        label: "환경설정",
        active: isSettingsRoute(location.pathname),
        children: [
          {
            id: "ledger-accounts",
            label: "계정 관리",
            active: location.pathname.startsWith(INTERNAL_ROUTES.accounts),
            onSelect: () => {
              setIsSettingsOpen(true);
              navigate(INTERNAL_ROUTES.accounts);
            },
          },
          {
            id: "ledger-categories",
            label: "분류 관리",
            active: location.pathname.startsWith(INTERNAL_ROUTES.categories),
            onSelect: () => {
              setIsSettingsOpen(true);
              navigate(INTERNAL_ROUTES.categories);
            },
          },
          {
            id: "ledger-import-profiles",
            label: "엑셀 가져오기 양식",
            active: location.pathname.startsWith(INTERNAL_ROUTES.importProfiles),
            onSelect: () => {
              setIsSettingsOpen(true);
              navigate(INTERNAL_ROUTES.importProfiles);
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
    let active = true;

    void getMyCalendars()
      .then((items) => {
        if (!active) return;
        setCalendars(items);
        setCalendarId(
          items.find((item) => item.isDefault)?.calendarId
            ?? items[0]?.calendarId
            ?? 0,
        );
      })
      .catch(() => {
        if (active) setCalendarError("캘린더 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoadingCalendars(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedCalendar = calendars.find((calendar) => calendar.calendarId === calendarId);
  const calendarControl = (
    <label className={styles.calendarControl}>
      <span>캘린더</span>
      <select
        value={calendarId}
        disabled={calendars.length === 0}
        onChange={(event) => setCalendarId(Number(event.target.value))}
      >
        {calendars.length === 0 && <option value={0}>선택 가능한 캘린더 없음</option>}
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
        <nav className={styles.sideNav} aria-label="가계부 메뉴">
          <strong className={styles.sideNavTitle}>가계부</strong>
          <NavItem to={INTERNAL_ROUTES.overview}>가계부 현황</NavItem>
          <NavItem to={INTERNAL_ROUTES.transactions}>거래내역</NavItem>
          <button
            type="button"
            className={[
              styles.sideNavGroup,
              styles.sideNavGroupButton,
              isSettingsRoute(location.pathname) ? styles.sideNavGroupActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-expanded={isSettingsOpen}
            aria-controls="ledger-settings-menu"
            onClick={() => setIsSettingsOpen((current) => !current)}
          >
            <span>환경설정</span>
            <span
              className={[
                styles.sideNavArrow,
                isSettingsOpen ? styles.sideNavArrowOpen : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            />
          </button>
          <div
            id="ledger-settings-menu"
            className={[
              styles.sideNavSubMenu,
              isSettingsOpen ? styles.sideNavSubMenuOpen : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <NavItem to={INTERNAL_ROUTES.accounts} nested>계정 관리</NavItem>
            <NavItem to={INTERNAL_ROUTES.categories} nested>분류 관리</NavItem>
            <NavItem to={INTERNAL_ROUTES.importProfiles} nested>
              엑셀 가져오기 양식
            </NavItem>
          </div>
        </nav>

        <div className={styles.content}>
          <LoadingOverlay active={loadingCalendars} label="캘린더 불러오는 중" />
          {calendarError && <p className={styles.errorMessage}>{calendarError}</p>}
          <Routes>
            <Route index element={<Navigate to="overview" replace />} />
            <Route
              path="overview"
              element={
                <LedgerOverview
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? ""}
                  calendarControl={calendarControl}
                />
              }
            />
            <Route
              path="transactions"
              element={
                <LedgerTransactions
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? ""}
                  calendarControl={calendarControl}
                />
              }
            />
            <Route
              path="accounts"
              element={
                <LedgerAccounts
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? ""}
                  calendarControl={calendarControl}
                />
              }
            />
            <Route
              path="categories"
              element={
                <LedgerCategories
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? ""}
                  calendarControl={calendarControl}
                />
              }
            />
            <Route path="rules" element={<Navigate to="../categories" replace />} />
            <Route
              path="import-profiles"
              element={
                <LedgerImportProfiles
                  calendarId={calendarId}
                  calendarName={selectedCalendar?.name ?? ""}
                  calendarControl={calendarControl}
                />
              }
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

function NavItem({ to, children, nested = false }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          styles.sideNavItem,
          nested ? styles.sideNavItemNested : "",
          isActive ? styles.sideNavItemActive : "",
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      {children}
    </NavLink>
  );
}
