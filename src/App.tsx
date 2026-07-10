import { useEffect, useState } from "react";
import { useRef } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { verifyStoredSession } from "./api/authApi";
import Home from "./pages/home/Home";
import Login from "./pages/home/Login";
import Signup from "./pages/home/Signup";
import homeIcon from "./assets/icons/home.svg";
import profilePrivacyIcon from "./assets/icons/profile-privacy.svg";
import themeMoonIcon from "./assets/icons/theme-moon.svg";
import themeSunIcon from "./assets/icons/theme-sun.svg";
import NotificationBell from "./pages/utility/notification-bell/NotificationBell";
import PersonalInfoPage from "./pages/utility/info/user-info/PersonalInfoPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { PageLoading } from "./common/components/Loading";
import { MobileHeaderProvider, useMobileHeader } from "./common/components/MobileHeaderContext";
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
  const [mobileHeaderOpen, setMobileHeaderOpen] = useState(false);
  const mobileHeaderRef = useRef<HTMLDivElement | null>(null);
  const hasMobileMenu = !!config.menuItems?.length;
  const fallbackTitle = location.pathname.startsWith("/profile") ? "개인정보" : "캘린더";
  const mobileTitle = config.title || fallbackTitle;

  useEffect(() => {
    setMobileHeaderOpen(false);
  }, [location.pathname, mobileTitle]);

  useEffect(() => {
    if (!mobileHeaderOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileHeaderRef.current) return;
      if (!mobileHeaderRef.current.contains(event.target as Node)) {
        setMobileHeaderOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileHeaderOpen]);

  const handleMobileHeaderClick = () => {
    if (!hasMobileMenu) return;
    setMobileHeaderOpen((prev) => !prev);
  };

  return (
    <nav className={styles.topNav}>
      <div className={styles.desktopHomeWrap}>
        <Link to="/home" className={styles.homeButton} aria-label="홈" title="홈">
          <img src={homeIcon} alt="" className={styles.navIconImage} aria-hidden="true" />
        </Link>
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
          <div className={styles.mobileHeaderMenu} role="menu">
            {config.menuItems?.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.active
                    ? `${styles.mobileHeaderMenuItem} ${styles.mobileHeaderMenuItemActive}`
                    : styles.mobileHeaderMenuItem
                }
                role="menuitem"
                onClick={() => {
                  setMobileHeaderOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
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

          <button type="button" className={styles.menuSheetItem}>
            <span className={`${styles.menuSheetIcon} ${styles.accountBookIcon}`} aria-hidden="true" />
            <span>가계부</span>
            <span className={styles.menuSheetChevron} aria-hidden="true" />
          </button>

          <button type="button" className={styles.menuSheetItem}>
            <span className={`${styles.menuSheetIcon} ${styles.minutesIcon}`} aria-hidden="true" />
            <span>회의록</span>
            <span className={styles.menuSheetChevron} aria-hidden="true" />
          </button>
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {isLoggedIn && <BottomNav />}
      </MobileHeaderProvider>
    </BrowserRouter>
  );
}
