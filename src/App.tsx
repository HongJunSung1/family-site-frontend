import { useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { verifyStoredSession } from "./api/authApi";
import Home from "./pages/home/Home";
import Login from "./pages/home/Login";
import Signup from "./pages/home/Signup";
import NotificationBell from "./pages/utility/notification-bell/NotificationBell";
import PersonalInfoPage from "./pages/utility/info/user-info/PersonalInfoPage";
import ProtectedRoute from "./routes/ProtectedRoute";

function TopNav() {
  const navigate = useNavigate();

  return (
    <nav
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid #333",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <Link to="/home" style={{ marginRight: 12 }}>
          홈
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <NotificationBell />

        <button
          type="button"
          onClick={() => navigate("/profile")}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "1px solid #ccc",
            background: "#f3f4f6",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
          aria-label="개인정보"
          title="개인정보"
        >
          내
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
      {isLoggedIn && <TopNav />}

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
              <Home onLogout={() => setIsLoggedIn(false)} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <PersonalInfoPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

