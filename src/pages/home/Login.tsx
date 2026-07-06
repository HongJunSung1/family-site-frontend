import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { loginAndStoreSession } from "../../api/authApi";

type Props = {
  onLogin: () => void;
};

export default function Login({ onLogin }: Props) {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberId, setRememberId] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem("rememberId");
    if (savedId) {
      setId(savedId);
      setRememberId(true);
    }
  }, []);

  const handleLogin = async () => {
    setErrorMsg("");

    if (!id.trim() || !password.trim()) {
      setErrorMsg("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    try {
      setLoading(true);

      const data = await loginAndStoreSession(id.trim(), password);

      if (!data.ok || !data.accessToken) {
        setErrorMsg(data.message ?? "로그인 응답이 올바르지 않습니다.");
        return;
      }

      if (rememberId) {
        localStorage.setItem("rememberId", id.trim());
      } else {
        localStorage.removeItem("rememberId");
      }

      onLogin();

      const to = location.state?.from || "/home";
      navigate(to, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setErrorMsg("아이디 또는 비밀번호가 올바르지 않습니다.");
          return;
        }

        setErrorMsg(error.data?.message ?? "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

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
          아이디
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="아이디를 입력해주세요."
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

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={rememberId}
            onChange={(e) => setRememberId(e.target.checked)}
          />
          ID 저장
        </label>

        {errorMsg && <div style={{ color: "crimson", fontSize: 14 }}>{errorMsg}</div>}

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

