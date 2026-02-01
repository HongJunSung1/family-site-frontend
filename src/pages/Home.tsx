import { useNavigate } from "react-router-dom";

export default function Home() {
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const navigate = useNavigate();

  const handleLogout = async () => {
    const token = localStorage.getItem("accessToken");

    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } finally {
      // ✅ 프론트 토큰 제거(서버 성공/실패와 무관하게 로그아웃 처리)
      localStorage.removeItem("accessToken");
      navigate("/login", { replace: true });
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>홈</h1>
      <button onClick={handleLogout}>로그아웃</button>
    </div>
  );
}