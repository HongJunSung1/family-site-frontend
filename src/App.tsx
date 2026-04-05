import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate  } from "react-router-dom";
import Home from "./pages/home/Home";
import Login from "./pages/home/Login";
import Signup from "./pages/home/Signup";
import ProtectedRoute from "./routes/ProtectedRoute";
import PersonalInfoPage from "./pages/utility/info/user-info/PersonalInfoPage";

const API_BASE = import.meta.env.VITE_API_URL;

// 네비게이션 바
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
        👤
      </button>
    </nav>
  );
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 앱 시작 시 로그인 유효성 검사
  useEffect(() => {
    const checkLogin = async () => {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        setIsLoggedIn(false);
        setChecking(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem("accessToken");
          setIsLoggedIn(false);
        }
      } catch {
        // 네트워크 오류 → 안전하게 로그아웃 처리
        localStorage.removeItem("accessToken");
        setIsLoggedIn(false);
      } finally {
        setChecking(false);
      }
    };

    checkLogin();
  }, [API_BASE]);

  // 서버 확인 중에는 아무 화면도 안 띄움
  if (checking) {
    return <div style={{ padding: 24 }}>로그인 상태 확인 중...</div>;
  }

  return (
    <BrowserRouter>
      {isLoggedIn && <TopNav />}

      <Routes>
        {/* 최초 진입 */}
        <Route
          path="/"
          element={
            isLoggedIn
              ? <Navigate to="/home" replace />
              : <Navigate to="/login" replace />
          }
        />

        <Route path="/login" element={<Login onLogin={() => setIsLoggedIn(true)} />} />
        <Route path="/signup" element={<Signup />} />

        {/* 보호 라우트 */}
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
