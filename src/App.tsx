import { useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
import styles from "./App.module.css";

type ThemeMode = "light" | "dark";

type TopNavProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

function TopNav({ theme, onToggleTheme }: TopNavProps) {
  const navigate = useNavigate();

  return (
    <nav className={styles.topNav}>
      <div>
        <Link to="/home" className={styles.homeButton} aria-label="홈" title="홈">
          <img src={homeIcon} alt="" className={styles.navIconImage} aria-hidden="true" />
        </Link>
      </div>

      <div className={styles.navActions}>
        <button
          type="button"
          onClick={onToggleTheme}
          role="switch"
          aria-checked={theme === "dark"}
          className={styles.navIconButton}
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

        <NotificationBell />

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
    const updateViewportHeight = () => {
      document.documentElement.style.setProperty("--app-viewport-height", `${window.innerHeight}px`);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
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
    return <div style={{ padding: 24 }}>로그인 상태 확인 중...</div>;
  }

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

