import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { loginAndStoreSession } from "../../api/authApi";
import styles from "./Auth.module.css";

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
    <div className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.title}>로그인</h1>
        <p className={styles.description}>가족 일정을 확인하려면 계정으로 로그인해주세요.</p>

        <div className={styles.stack}>
          <label className={styles.field}>
            아이디
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="아이디를 입력해주세요."
              autoComplete="username"
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="current-password"
              className={styles.input}
            />
          </label>

          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={rememberId}
              onChange={(e) => setRememberId(e.target.checked)}
            />
            ID 저장
          </label>

          {errorMsg && <div className={styles.error}>{errorMsg}</div>}

          <button className={styles.submitButton} onClick={handleLogin} disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <div className={styles.linkRow}>
            <Link to="/signup">회원가입</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
