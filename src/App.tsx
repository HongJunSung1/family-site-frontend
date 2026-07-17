import { useEffect, useState } from "react";
import { useRef } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { verifyStoredSession } from "./api/authApi";
import Home from "./pages/home/Home";
import Login from "./pages/home/Login";
import Signup from "./pages/home/Signup";
import ConferenceReport from "./pages/utility/conference-report/ConferenceReport";
import HouseholdAccounts from "./pages/utility/household-accounts/HouseholdAccounts";
import homeIcon from "./assets/icons/home.svg";
import profilePrivacyIcon from "./assets/icons/profile-privacy.svg";
import themeMoonIcon from "./assets/icons/theme-moon.svg";
import themeSunIcon from "./assets/icons/theme-sun.svg";
import NotificationBell from "./pages/utility/notification-bell/NotificationBell";
import PersonalInfoPage from "./pages/utility/info/user-info/PersonalInfoPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { FamilyLoader, PageLoading, useStableLoading } from "./common/loading";
import { MobileHeaderProvider, useMobileHeader } from "./common/mobile-header";
import styles from "./App.module.css";

type ThemeMode = "light" | "dark";

type TopNavProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

// PC 상단 네비게이션과 모바일 상단 헤더 관리
function TopNav({ theme, onToggleTheme }: TopNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useMobileHeader();
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [mobileHeaderOpen, setMobileHeaderOpen] = useState(false);
  const [mobileSubMenuId, setMobileSubMenuId] = useState<string | null>(null);
  const [mobilePinnedSubMenuId, setMobilePinnedSubMenuId] = useState<string | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const hasMobileMenu = !!config.menuItems?.length;
  const fallbackTitle = location.pathname.startsWith("/profile")
    ? "개인정보"
    : location.pathname.startsWith("/household-accounts")
    ? "가계부"
    : location.pathname.startsWith("/conference-report")
    ? "회의록"
    : "캘린더";
  const mobileTitle = config.title || fallbackTitle;

  // PC 메뉴 바깥 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!desktopMenuOpen) return;

    // PC 메뉴 영역 밖 pointer 이벤트 감지
    const handlePointerDown = (event: PointerEvent) => {
      if (!desktopMenuRef.current) return;
      if (!desktopMenuRef.current.contains(event.target as Node)) {
        setDesktopMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [desktopMenuOpen]);

  // 모바일 헤더 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!mobileHeaderOpen) return;

    // 모바일 헤더 영역 밖 pointer 이벤트 감지
    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileHeaderRef.current) return;
      if (!mobileHeaderRef.current.contains(event.target as Node)) {
        setMobileHeaderOpen(false);
        setMobileSubMenuId(null);
        setMobilePinnedSubMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileHeaderOpen]);

  // 모바일 헤더 타이틀 클릭 시 드롭다운 열기/닫기
  const handleMobileHeaderClick = () => {
    if (!hasMobileMenu) return;
    setMobileHeaderOpen((prev) => {
      const next = !prev;
      if (!next) {
        setMobileSubMenuId(null);
        setMobilePinnedSubMenuId(null);
      }
      return next;
    });
  };

  const hasNestedMobileMenu = !!config.menuItems?.some((item) => item.children?.length);

  return (
    <nav className={styles.topNav}>
      <div className={styles.desktopHomeWrap}>
        <Link to="/home" className={styles.homeButton} aria-label="홈" title="홈">
          <img src={homeIcon} alt="" className={styles.navIconImage} aria-hidden="true" />
        </Link>

        <div className={styles.desktopMenuWrap} ref={desktopMenuRef}>
          <button
            type="button"
            className={styles.desktopMenuButton}
            onClick={() => setDesktopMenuOpen((prev) => !prev)}
            aria-label="메뉴"
            aria-expanded={desktopMenuOpen}
            title="메뉴"
          >
            <span className={styles.desktopMenuIcon} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          </button>

          {desktopMenuOpen && (
            <div className={styles.desktopMenuDropdown} role="menu">
              <Link
                to="/household-accounts"
                className={styles.desktopMenuItem}
                role="menuitem"
                onClick={() => setDesktopMenuOpen(false)}
              >
                <span className={`${styles.desktopMenuItemIcon} ${styles.accountBookIcon}`} aria-hidden="true" />
                <span>가계부</span>
              </Link>

              <Link
                to="/conference-report"
                className={styles.desktopMenuItem}
                role="menuitem"
                onClick={() => setDesktopMenuOpen(false)}
              >
                <span className={`${styles.desktopMenuItemIcon} ${styles.minutesIcon}`} aria-hidden="true" />
                <span>회의록</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className={styles.mobileHeaderPicker} ref={mobileHeaderRef}>
        <button
          type="button"
          className={styles.mobileFamilyButton}
          aria-label={hasMobileMenu ? `${mobileTitle} 선택` : mobileTitle}
          aria-expanded={hasMobileMenu ? mobileHeaderOpen : undefined}
          onClick={handleMobileHeaderClick}
        >
          <span className={styles.familyName}>{mobileTitle}</span>
          {hasMobileMenu && <span className={styles.familyChevron} aria-hidden="true" />}
        </button>

        {hasMobileMenu && mobileHeaderOpen && (
          <div
            className={[
              styles.mobileHeaderMenu,
              hasNestedMobileMenu ? styles.mobileHeaderMenuCompact : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="menu"
          >
            {config.menuItems?.map((item) => (
              <div key={item.id} className={styles.mobileHeaderMenuBranch}>
                <button
                  type="button"
                  className={
                    item.active
                      ? `${styles.mobileHeaderMenuItem} ${styles.mobileHeaderMenuItemActive}`
                      : styles.mobileHeaderMenuItem
                  }
                  role="menuitem"
                  onClick={() => {
                    if (item.children?.length) {
                      setMobilePinnedSubMenuId((prev) => {
                        const next = prev === item.id ? null : item.id;
                        setMobileSubMenuId(next);
                        return next;
                      });
                      return;
                    }

                    setMobileHeaderOpen(false);
                    setMobileSubMenuId(null);
                    setMobilePinnedSubMenuId(null);
                    item.onSelect?.();
                  }}
                  onPointerEnter={() => {
                    if (item.children?.length) {
                      setMobileSubMenuId(item.id);
                      return;
                    }

                    if (!mobilePinnedSubMenuId) {
                      setMobileSubMenuId(null);
                    }
                  }}
                >
                  <span>{item.label}</span>
                  {item.children?.length && (
                    <span className={styles.mobileHeaderMenuArrow} aria-hidden="true" />
                  )}
                </button>

                {item.children?.length && mobileSubMenuId === item.id && (
                  <div className={styles.mobileHeaderSubMenu} role="menu">
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        className={
                          child.active
                            ? `${styles.mobileHeaderMenuItem} ${styles.mobileHeaderMenuItemActive}`
                            : styles.mobileHeaderMenuItem
                        }
                        role="menuitem"
                        onClick={() => {
                          setMobileHeaderOpen(false);
                          setMobileSubMenuId(null);
                          setMobilePinnedSubMenuId(null);
                          child.onSelect?.();
                        }}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.navActions}>
        <button
          type="button"
          onClick={onToggleTheme}
          role="switch"
          aria-checked={theme === "dark"}
          className={`${styles.navIconButton} ${styles.mobileThemeButton}`}
          aria-label={theme === "dark" ? "라이트모드로 전환" : "다크모드로 전환"}
          title={theme === "dark" ? "라이트모드로 전환" : "다크모드로 전환"}
        >
          <img
            src={theme === "dark" ? themeSunIcon : themeMoonIcon}
            alt=""
            className={styles.navIconImage}
            aria-hidden="true"
          />
        </button>

        <div className={styles.desktopOnly}>
          <NotificationBell />
        </div>

        <button
          type="button"
          onClick={() => navigate("/profile")}
          className={styles.profileButton}
          aria-label="개인정보"
          title="개인정보"
        >
          <img src={profilePrivacyIcon} alt="" className={styles.navIconImage} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

// 경로와 화면별 헤더 제목 변경 시 열린 메뉴 상태 초기화
function RoutedTopNav(props: TopNavProps) {
  const location = useLocation();
  const { config } = useMobileHeader();
  return <TopNav key={`${location.pathname}:${config.title ?? ""}`} {...props} />;
}

// 모바일 하단 네비게이션과 메뉴 시트 관리
function BottomNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomNavRef = useRef<HTMLElement | null>(null);
  const menuSheetRef = useRef<HTMLDivElement | null>(null);

  // 하단 메뉴 시트 바깥 클릭 시 닫기
  useEffect(() => {
    if (!menuOpen) return;

    // 하단바와 메뉴 시트 밖 pointer 이벤트 감지
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (bottomNavRef.current?.contains(target) || menuSheetRef.current?.contains(target)) {
        return;
      }

      setMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  return (
    <>
      {menuOpen && (
        <div className={styles.mobileMenuSheet} role="dialog" aria-label="메뉴" ref={menuSheetRef}>
          <div className={styles.menuSheetHandle} aria-hidden="true" />

          <Link
            to="/household-accounts"
            className={styles.menuSheetItem}
            onClick={() => setMenuOpen(false)}
          >
            <span className={`${styles.menuSheetIcon} ${styles.accountBookIcon}`} aria-hidden="true" />
            <span>가계부</span>
            <span className={styles.menuSheetChevron} aria-hidden="true" />
          </Link>

          <Link
            to="/conference-report"
            className={styles.menuSheetItem}
            onClick={() => setMenuOpen(false)}
          >
            <span className={`${styles.menuSheetIcon} ${styles.minutesIcon}`} aria-hidden="true" />
            <span>회의록</span>
            <span className={styles.menuSheetChevron} aria-hidden="true" />
          </Link>
        </div>
      )}

      <nav className={styles.bottomNav} aria-label="모바일 하단 메뉴" ref={bottomNavRef}>
        <Link
          to="/home"
          className={styles.bottomNavItem}
          onClick={() => setMenuOpen(false)}
          aria-label="홈"
          title="홈"
        >
          <img src={homeIcon} alt="" className={styles.bottomNavIcon} aria-hidden="true" />
        </Link>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${menuOpen ? styles.bottomNavItemActive : ""}`}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-label="메뉴"
          title="메뉴"
        >
          <span className={styles.bottomMenuIcon} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className={styles.bottomNavItem} aria-label="알림" title="알림">
          <NotificationBell placement="bottom" />
        </div>
      </nav>
    </>
  );
}

// 홈/개인정보 전환 중 표시할 짧은 로딩 오버레이
function RouteTransitionLoading({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  const [transition, setTransition] = useState({
    path: location.pathname,
    visible: false,
  });

  if (transition.path !== location.pathname) {
    const isProfileHomeTransition =
      enabled &&
      ((transition.path === "/home" && location.pathname === "/profile") ||
        (transition.path === "/profile" && location.pathname === "/home"));

    setTransition({
      path: location.pathname,
      visible: isProfileHomeTransition,
    });
  }

  // 홈과 개인정보 사이 이동 로딩 표시 시간 관리
  useEffect(() => {
    if (!transition.visible) return;
    const timer = window.setTimeout(() => {
      setTransition((current) => ({ ...current, visible: false }));
    }, 360);

    return () => window.clearTimeout(timer);
  }, [transition.visible]);

  const loadingVisibility = useStableLoading(transition.visible);

  if (!loadingVisibility.mounted) return null;

  return (
    <div
      className={`${styles.routeLoadingOverlay} ${
        loadingVisibility.exiting ? styles.routeLoadingOverlayExiting : styles.routeLoadingOverlayVisible
      }`}
    >
      <div className={styles.routeLoadingSurface}>
        <FamilyLoader label="화면 이동 중" />
      </div>
    </div>
  );
}

// 라우트 이동 시 캘린더 hover 툴팁 잔상 제거
function CalendarHoverCleanup() {
  const location = useLocation();

  useEffect(() => {
    document.getElementById("pz-floating-event-tooltip")?.remove();
    document.querySelectorAll(".pz-tooltip-layer-open").forEach((element) => {
      element.classList.remove("pz-tooltip-layer-open");
    });
  }, [location.pathname]);

  return null;
}

// 앱 라우팅, 로그인 상태, 테마, 공통 네비게이션 관리
export default function App() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";

    const storedTheme = window.localStorage.getItem("theme");
    return storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
  });

  // 테마 상태를 document와 로컬 저장소에 반영
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  // 모바일 브라우저 주소창 변동을 고려한 앱 높이 고정
  useEffect(() => {
    let viewportWidth = window.innerWidth;
    let lockedViewportHeight = window.innerHeight;

    // CSS 변수에 현재 앱 높이 반영
    const applyViewportHeight = () => {
      document.documentElement.style.setProperty("--app-viewport-height", `${lockedViewportHeight}px`);
    };

    // 화면 크기 변경 시 앱 높이 재계산
    const updateViewportHeight = () => {
      const nextWidth = window.innerWidth;
      const nextHeight = window.innerHeight;

      if (Math.abs(nextWidth - viewportWidth) > 24) {
        viewportWidth = nextWidth;
        lockedViewportHeight = nextHeight;
      } else {
        lockedViewportHeight = Math.min(lockedViewportHeight, nextHeight);
      }

      applyViewportHeight();
    };

    applyViewportHeight();
    window.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  // 라이트/다크 테마 전환
  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // 저장된 세션 확인 후 로그인 상태 초기화
  useEffect(() => {
    // 서버 기준 로그인 세션 검증
    const checkLogin = async () => {
      try {
        const session = await verifyStoredSession();
        setIsLoggedIn(!!session);
      } catch {
        setIsLoggedIn(false);
      } finally {
        setChecking(false);
      }
    };

    checkLogin();
  }, []);

  if (checking) {
    return <PageLoading label="로그인 상태 확인 중" />;
  }

  return (
    <BrowserRouter>
      <MobileHeaderProvider>
        {isLoggedIn && <RoutedTopNav theme={theme} onToggleTheme={toggleTheme} />}

        <Routes>
          <Route
            path="/"
            element={isLoggedIn ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />}
          />

          <Route path="/login" element={<Login onLogin={() => setIsLoggedIn(true)} />} />
          <Route path="/signup" element={<Signup />} />

          <Route
            path="/home"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Home />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <PersonalInfoPage onLogout={() => setIsLoggedIn(false)} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/household-accounts"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <HouseholdAccounts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/conference-report"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <ConferenceReport />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <CalendarHoverCleanup />
        <RouteTransitionLoading enabled={isLoggedIn} />

        {isLoggedIn && <BottomNav />}
      </MobileHeaderProvider>
    </BrowserRouter>
  );
}
