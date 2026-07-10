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
import { FamilyLoader, PageLoading } from "./common/loading";
import { MobileHeaderProvider, useMobileHeader } from "./common/mobile-header";
import styles from "./App.module.css";

type ThemeMode = "light" | "dark";

type TopNavProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

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

  useEffect(() => {
    setMobileHeaderOpen(false);
    setMobileSubMenuId(null);
    setMobilePinnedSubMenuId(null);
    setDesktopMenuOpen(false);
  }, [location.pathname, mobileTitle]);

  useEffect(() => {
    if (!desktopMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!desktopMenuRef.current) return;
      if (!desktopMenuRef.current.contains(event.target as Node)) {
        setDesktopMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [desktopMenuOpen]);

  useEffect(() => {
    if (!mobileHeaderOpen) return;

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

function BottomNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomNavRef = useRef<HTMLElement | null>(null);
  const menuSheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

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

function RouteTransitionLoading({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const nextPath = location.pathname;
    previousPathRef.current = nextPath;

    const isProfileHomeTransition =
      enabled &&
      ((previousPath === "/home" && nextPath === "/profile") ||
        (previousPath === "/profile" && nextPath === "/home"));

    if (!isProfileHomeTransition) return;

    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 360);

    return () => window.clearTimeout(timer);
  }, [enabled, location.pathname]);

  if (!visible) return null;

  return (
    <div className={styles.routeLoadingOverlay}>
      <div className={styles.routeLoadingSurface}>
        <FamilyLoader label="화면 이동 중" />
      </div>
    </div>
  );
}

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

export default function App() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";

    const storedTheme = window.localStorage.getItem("theme");
    return storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    let viewportWidth = window.innerWidth;
    let lockedViewportHeight = window.innerHeight;

    const applyViewportHeight = () => {
      document.documentElement.style.setProperty("--app-viewport-height", `${lockedViewportHeight}px`);
    };

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
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
        {isLoggedIn && <TopNav theme={theme} onToggleTheme={toggleTheme} />}

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
