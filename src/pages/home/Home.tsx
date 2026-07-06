import { useNavigate } from "react-router-dom";
import Calendar from "../utility/Calendar";
import { logoutAndClearSession } from "../../api/authApi";

type Props = {
  onLogout: () => void;
};

export default function Home({ onLogout }: Props) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutAndClearSession();
    } finally {
      onLogout();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Calendar />
      <button onClick={handleLogout}>로그아웃</button>
    </div>
  );
}

