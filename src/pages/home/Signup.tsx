import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, isApiBaseConfigured } from "../../api/client";
import { signup } from "../../api/authApi";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    id: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      if (!form.email || !form.password) {
        alert("이메일과 비밀번호는 필수입니다.");
        return;
      }
      if (!form.id) {
        alert("아이디는 필수입니다.");
        return;
      }
      if (form.password.length < 8) {
        alert("비밀번호는 8자 이상 입력해주세요.");
        return;
      }
      if (form.password !== form.passwordConfirm) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
      }
      if (!isApiBaseConfigured()) {
        alert("API 주소가 설정되지 않았습니다. (.env.local의 VITE_API_URL 확인)");
        return;
      }

      await signup({
        name: form.name,
        id: form.id,
        email: form.email,
        password: form.password,
      });

      alert("회원가입 성공! 로그인 화면으로 이동합니다.");
      navigate("/login");
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.data?.message ?? "회원가입 실패");
        return;
      }

      alert(`네트워크 오류: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h1>회원가입</h1>
      <p style={{ opacity: 0.8 }}>가족 사이트 계정을 생성합니다.</p>

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>이름</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="홍길동"
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>아이디 *</label>
          <input
            name="id"
            value={form.id}
            onChange={onChange}
            placeholder="jshong"
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>이메일 *</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="name@example.com"
            style={{ width: "100%", padding: 10 }}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>비밀번호 *</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="8자 이상"
            style={{ width: "100%", padding: 10 }}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>비밀번호 확인 *</label>
          <input
            name="passwordConfirm"
            type="password"
            value={form.passwordConfirm}
            onChange={onChange}
            placeholder="비밀번호를 한 번 더 입력"
            style={{ width: "100%", padding: 10 }}
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: 12,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "처리 중..." : "가입하기"}
        </button>
      </form>

      <div style={{ marginTop: 12 }}>
        이미 계정이 있나요? <Link to="/login">로그인</Link>
      </div>

      <div style={{ marginTop: 8 }}>
        <Link to="/">처음으로</Link>
      </div>
    </div>
  );
}
