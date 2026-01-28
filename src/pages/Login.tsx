import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div style={{ padding: 24 }}>
      <h1>로그인</h1>
      <p>Login 화면입니다.</p>

      <Link to="/">← 홈으로</Link>
    </div>
  );
}