import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    familyCode: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ 지금은 백엔드 연결 전이라 "동작 흉내"만 냅니다.
    // 나중에 여기서 POST /api/signup 같은 걸 호출하게 될 거예요.
    setSubmitting(true);
    try {
      // 간단한 프론트 검증(선택)
      if (!form.email || !form.password) {
        alert("이메일과 비밀번호는 필수입니다.");
        return;
      }

      alert(
        [
          "✅ (임시) 회원가입 제출됨",
          `이름: ${form.name}`,
          `이메일: ${form.email}`,
          `가족코드: ${form.familyCode || "(없음)"}`,
          "",
          "다음 단계에서 Workers API로 실제 가입 처리 연결 예정",
        ].join("\n")
      );

      // 가입 후 로그인 화면으로 이동 (일반적인 UX)
      navigate("/login");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h1>회원가입</h1>
      <p style={{ opacity: 0.8 }}>
        가족 사이트 계정을 생성합니다. (현재는 UI만 대충 구현)
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>이름</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="홍준성"
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
          <label style={{ display: "block", marginBottom: 6 }}>
            비밀번호 *
          </label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="8자 이상 권장"
            style={{ width: "100%", padding: 10 }}
            required
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            가족 초대코드 (선택)
          </label>
          <input
            name="familyCode"
            value={form.familyCode}
            onChange={onChange}
            placeholder="예: ABCD-1234"
            style={{ width: "100%", padding: 10 }}
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
        <Link to="/">← 홈으로</Link>
      </div>
    </div>
  );
}
