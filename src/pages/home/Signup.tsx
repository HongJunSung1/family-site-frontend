import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, isApiBaseConfigured } from "../../api/client";
import { signup } from "../../api/authApi";
import { AlertDialog } from "../../common/dialog";
import { InputField } from "../../common/input";
import styles from "./Auth.module.css";

type AlertState = {
  open: boolean;
  title: string;
  message: string;
  onClose?: () => void;
};

// 회원가입 화면
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
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    title: "",
    message: "",
  });

  // 공통 안내창 상태 설정
  const showAlert = (message: string, title = "안내", onClose?: () => void) => {
    setAlertState({ open: true, title, message, onClose });
  };

  // 안내창 닫기 및 후속 이동 콜백 실행
  const closeAlert = () => {
    const callback = alertState.onClose;
    setAlertState((prev) => ({ ...prev, open: false, onClose: undefined }));
    callback?.();
  };

  // 회원가입 입력값 변경 처리
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 회원가입 유효성 검사 및 가입 요청
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!form.email || !form.password) {
        showAlert("이메일과 비밀번호는 필수입니다.");
        return;
      }
      if (!form.id) {
        showAlert("아이디는 필수입니다.");
        return;
      }
      if (form.password.length < 8) {
        showAlert("비밀번호는 8자 이상 입력해주세요.");
        return;
      }
      if (form.password !== form.passwordConfirm) {
        showAlert("비밀번호가 일치하지 않습니다.");
        return;
      }
      if (!isApiBaseConfigured()) {
        showAlert("API 주소가 설정되지 않았습니다. (.env.local의 VITE_API_URL 확인)");
        return;
      }

      setSubmitting(true);
      await signup({
        name: form.name,
        id: form.id,
        email: form.email,
        password: form.password,
      });

      showAlert("회원가입 성공! 로그인 화면으로 이동합니다.", "회원가입 완료", () =>
        navigate("/login")
      );
    } catch (err) {
      if (err instanceof ApiError) {
        showAlert(err.data?.message ?? "회원가입 실패");
        return;
      }

      showAlert(`네트워크 오류: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.panel} ${styles.signupPanel}`}>
        <h1 className={styles.title}>회원가입</h1>
        <p className={styles.description}>가족 사이트 계정을 생성합니다.</p>

        <form className={styles.form} onSubmit={onSubmit}>
          <InputField
            label="이름"
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="홍길동"
          />

          <InputField
            label="아이디"
            name="id"
            value={form.id}
            onChange={onChange}
            placeholder="jshong"
            requiredMark
          />

          <InputField
            label="이메일"
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="name@example.com"
            autoComplete="email"
            required
            requiredMark
          />

          <InputField
            label="비밀번호"
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="8자 이상"
            autoComplete="new-password"
            required
            requiredMark
          />

          <InputField
            label="비밀번호 확인"
            name="passwordConfirm"
            type="password"
            value={form.passwordConfirm}
            onChange={onChange}
            placeholder="비밀번호를 한 번 더 입력"
            autoComplete="new-password"
            required
            requiredMark
          />

          <button className={styles.submitButton} type="submit" disabled={submitting}>
            {submitting ? "처리 중..." : "가입하기"}
          </button>
        </form>

        <div className={styles.linkRow}>
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </div>

        <div className={styles.linkRow}>
          <Link to="/">처음으로</Link>
        </div>
      </section>

      <AlertDialog
        open={alertState.open}
        title={alertState.title}
        message={alertState.message}
        onClose={closeAlert}
      />
    </div>
  );
}
