import { useNavigate } from "react-router-dom";
import Calendar from "../utility/Calendar";


const API_BASE = import.meta.env.VITE_API_URL;

type Props = {
  onLogout: () => void;
};

export default function Home({ onLogout }: Props) {
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
      // ✅ 프론트 토큰 제거 + App 상태 갱신
      localStorage.removeItem("accessToken");
      onLogout();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>홈</h1>
      <Calendar />
      <button onClick={handleLogout}>로그아웃</button>
    </div>
  );
}
