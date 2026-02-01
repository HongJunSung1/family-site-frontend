import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./routes/ProtectedRoute";


export default function App() {
  const isLoggedIn = localStorage.getItem("accessToken");

  return (
    <BrowserRouter>
    {isLoggedIn && (
      <nav style={{ padding: 12, borderBottom: "1px solid #333" }}>
        <Link to="/" style={{ marginRight: 12 }}>홈</Link>
        {/* <Link to="/login" style={{ marginRight: 12 }}>로그인</Link> */}
        {/* <Link to="/signup">회원가입</Link> */}
      </nav>
    )}
      <Routes>
        {/* 최초 진입: 로그인 안했으면 login으로 */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* ✅ 보호 라우트 */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* 없는 주소는 홈으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}