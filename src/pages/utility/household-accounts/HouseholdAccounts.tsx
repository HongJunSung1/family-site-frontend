import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getMyCalendars, type MyCalendar } from "../../../api/calendarApi";
import { LoadingOverlay } from "../../../common/loading";
import { ConfirmDialog } from "../../../common/dialog";
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

type LedgerScreen = "overview" | "transactions" | "accounts" | "categories" | "importProfiles";

function getCurrentScreen(pathname: string): LedgerScreen {
  if (pathname.startsWith(INTERNAL_ROUTES.transactions)) return "transactions";
  if (pathname.startsWith(INTERNAL_ROUTES.accounts)) return "accounts";
  if (pathname.startsWith(INTERNAL_ROUTES.categories)) return "categories";
  if (pathname.startsWith(INTERNAL_ROUTES.importProfiles)) return "importProfiles";
  return "overview";
}

function isSettingsRoute(pathname: string) {
  return SETTINGS_ROUTES.some((route) => pathname.startsWith(route));
}

// 현재 가계부 하위 경로에 해당하는 모바일 화면 제목 반환
function getCurrentTitle(pathname: string) {
  return ({
    overview: "가계부 현황",
    transactions: "거래내역",
    accounts: "계정 관리",
    categories: "분류 관리",
    importProfiles: "엑셀 가져오기 양식",
  } satisfies Record<LedgerScreen, string>)[getCurrentScreen(pathname)];
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
  const [hasUnsavedTransactionChanges, setHasUnsavedTransactionChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ type: "route"; path: string } | { type: "calendar"; calendarId: number } | null>(null);
  const activeScreen = getCurrentScreen(location.pathname);
  const [mountedScreens, setMountedScreens] = useState<Set<LedgerScreen>>(() => new Set([activeScreen]));
  const currentTitle = getCurrentTitle(location.pathname);
  if (!mountedScreens.has(activeScreen)) {
    setMountedScreens(new Set([...mountedScreens, activeScreen]));
  }

  const requestRouteNavigation = useCallback((path: string) => {
    if (hasUnsavedTransactionChanges) {
      setPendingNavigation({ type: "route", path });
      return;
    }
    navigate(path);
  }, [hasUnsavedTransactionChanges, navigate]);

  const mobileMenuItems = useMemo(
    () => [
      {
        id: "ledger-overview",
        label: "가계부 현황",
        active: location.pathname.startsWith(INTERNAL_ROUTES.overview),
        onSelect: () => requestRouteNavigation(INTERNAL_ROUTES.overview),
      },
      {
        id: "ledger-transactions",
        label: "거래내역",
        active: location.pathname.startsWith(INTERNAL_ROUTES.transactions),
        onSelect: () => requestRouteNavigation(INTERNAL_ROUTES.transactions),
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
              requestRouteNavigation(INTERNAL_ROUTES.accounts);
            },
          },
          {
            id: "ledger-categories",
            label: "분류 관리",
            active: location.pathname.startsWith(INTERNAL_ROUTES.categories),
            onSelect: () => {
              setIsSettingsOpen(true);
              requestRouteNavigation(INTERNAL_ROUTES.categories);
            },
          },
          {
            id: "ledger-import-profiles",
            label: "엑셀 가져오기 양식",
            active: location.pathname.startsWith(INTERNAL_ROUTES.importProfiles),
            onSelect: () => {
              setIsSettingsOpen(true);
              requestRouteNavigation(INTERNAL_ROUTES.importProfiles);
            },
          },
        ],
      },
    ],
    [location.pathname, requestRouteNavigation],
  );

  useEffect(() => {
    if (!hasUnsavedTransactionChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (nextPath === currentPath) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({ type: "route", path: nextPath });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleNavigationClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleNavigationClick, true);
    };
  }, [hasUnsavedTransactionChanges]);

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
        onChange={(event) => {
          const nextCalendarId = Number(event.target.value);
          if (hasUnsavedTransactionChanges) {
            setPendingNavigation({ type: "calendar", calendarId: nextCalendarId });
            return;
          }
          setCalendarId(nextCalendarId);
        }}
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
            <Route path="overview" element={null} />
            <Route path="transactions" element={null} />
            <Route path="accounts" element={null} />
            <Route path="categories" element={null} />
            <Route path="rules" element={<Navigate to="../categories" replace />} />
            <Route path="import-profiles" element={null} />
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Routes>
          {(mountedScreens.has("overview") || activeScreen === "overview") && <div hidden={activeScreen !== "overview"}>
            <LedgerOverview calendarId={calendarId} calendarName={selectedCalendar?.name ?? ""} calendarControl={calendarControl} />
          </div>}
          {(mountedScreens.has("transactions") || activeScreen === "transactions") && <div hidden={activeScreen !== "transactions"}>
            <LedgerTransactions
              calendarId={calendarId}
              calendarName={selectedCalendar?.name ?? ""}
              calendarControl={calendarControl}
              onUnsavedChangesChange={setHasUnsavedTransactionChanges}
            />
          </div>}
          {(mountedScreens.has("accounts") || activeScreen === "accounts") && <div hidden={activeScreen !== "accounts"}>
            <LedgerAccounts calendarId={calendarId} calendarName={selectedCalendar?.name ?? ""} calendarControl={calendarControl} />
          </div>}
          {(mountedScreens.has("categories") || activeScreen === "categories") && <div hidden={activeScreen !== "categories"}>
            <LedgerCategories calendarId={calendarId} calendarName={selectedCalendar?.name ?? ""} calendarControl={calendarControl} />
          </div>}
          {(mountedScreens.has("importProfiles") || activeScreen === "importProfiles") && <div hidden={activeScreen !== "importProfiles"}>
            <LedgerImportProfiles calendarId={calendarId} calendarName={selectedCalendar?.name ?? ""} calendarControl={calendarControl} />
          </div>}
        </div>
      </div>
      <ConfirmDialog
        open={pendingNavigation !== null}
        title="작성 내용 확인"
        message="저장하지 않은 입력 또는 수정 내용이 있습니다. 다른 화면으로 이동하시겠습니까?"
        cancelLabel="아니오"
        confirmLabel="예"
        onClose={() => setPendingNavigation(null)}
        onConfirm={() => {
          const navigation = pendingNavigation;
          setPendingNavigation(null);
          setHasUnsavedTransactionChanges(false);
          if (navigation?.type === "route") navigate(navigation.path);
          if (navigation?.type === "calendar") setCalendarId(navigation.calendarId);
        }}
      />
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
