import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type LoginResponse = {
  accessToken: string;
  // 필요하면 user 정보도 같이 내려주기: userId, name 등
};

export default function Login() {
  const API_BASE = import.meta.env.VITE_API_URL || "";
  
  const navigate = useNavigate();
  const location = useLocation() as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMsg, setErrorMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  const handleLogin = async () => {
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("아이디와 비밀번호를 입력해주세요.");
      return;
    }    
    
    try {
      setLoading(true);

      // ✅ 백엔드 로그인 API 호출 (URL은 본인 환경에 맞게)
      // 예: Vite proxy면 "/api/login" 가능
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), 
                               password 
                            }),
      });

      if (res.status === 401) {
        // ✅ 아이디/비번 불일치
        setErrorMsg("아이디 또는 비밀번호가 다릅니다.");
        return;
      }

      if (!res.ok) {
        setErrorMsg("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const data = (await res.json()) as LoginResponse;

      // ✅ 토큰 저장
      localStorage.setItem("accessToken", data.accessToken);

      // ✅ 원래 가려던 페이지가 있으면 복귀, 없으면 /home
      const to = location.state?.from || "/home";
      navigate(to, { replace: true });
    } catch (e) {
      setErrorMsg("네트워크 오류가 발생했습니다. 서버 연결을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") handleLogin();
  };



  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1>로그인</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label>
          이메일
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="example@email.com"
            autoComplete="username"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="current-password"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        {errorMsg && (
          <div style={{ color: "crimson", fontSize: 14 }}>
            {errorMsg}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading} style={{ padding: 10 }}>
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div style={{ marginTop: 8 }}>
          <Link to="/signup">회원가입</Link>
        </div>
      </div>
    </div>
  );
}