import { useEffect, useState } from "react";
import { hasAccessToken } from "../../../../api/client";
import { getPersonalInfo, updateProfile, type PersonalInfoResponse } from "../../../../api/userApi";
import styles from "./BasicPersonalInfo.module.css";

export default function BasicPersonalInfo() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [user, setUser] = useState<PersonalInfoResponse["user"] | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const fetchPersonalInfo = async () => {
      if (!hasAccessToken()) {
        setErrorMsg("로그인 정보가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        const data = await getPersonalInfo();

        if (!data.ok) {
          setErrorMsg("개인정보를 불러오지 못했습니다.");
          return;
        }

        setUser(data.user);
        setEditName(data.user?.name ?? "");
        setEditEmail(data.user?.email ?? "");
      } catch (err) {
        console.error(err);
        setErrorMsg("서버 통신 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalInfo();
  }, []);

  const openSaveConfirm = () => {
    if (!user) return;

    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim();

    setErrorMsg("");
    setSuccessMsg("");

    if (!trimmedName) {
      setErrorMsg("이름을 입력해주세요.");
      return;
    }

    if (!trimmedEmail) {
      setErrorMsg("이메일을 입력해주세요.");
      return;
    }

    if (trimmedName === (user.name ?? "") && trimmedEmail === (user.email ?? "")) {
      setErrorMsg("변경된 내용이 없습니다.");
      return;
    }

    setConfirmOpen(true);
  };

  const saveBasicInfo = async () => {
    if (!hasAccessToken()) {
      setErrorMsg("로그인 정보가 없습니다.");
      setConfirmOpen(false);
      return;
    }

    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim();

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const data = await updateProfile({
        name: trimmedName,
        email: trimmedEmail,
      });

      if (!data.ok) {
        setErrorMsg(data.message ?? "개인정보 수정에 실패했습니다.");
        return;
      }

      setUser((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          name: data.user?.name ?? trimmedName,
          email: data.user?.email ?? trimmedEmail,
          login_id: data.user?.login_id ?? prev.login_id,
          created_at: data.user?.created_at ?? prev.created_at,
          defaultCalendarId: data.user?.defaultCalendarId ?? prev.defaultCalendarId,
        };
      });

      setEditName(data.user?.name ?? trimmedName);
      setEditEmail(data.user?.email ?? trimmedEmail);
      setSuccessMsg("기본 개인정보가 수정되었습니다.");
      setConfirmOpen(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("서버 통신 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.pageStateBox}>개인정보를 불러오는 중...</div>;
  }

  if (errorMsg && !user) {
    return <div className={styles.pageStateBoxError}>{errorMsg}</div>;
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>기본 개인정보</div>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={openSaveConfirm}
            disabled={saving}
          >
            {saving ? "수정 중..." : "수정"}
          </button>
        </div>

        {errorMsg && <div className={styles.inlineError}>{errorMsg}</div>}
        {successMsg && <div className={styles.inlineSuccess}>{successMsg}</div>}

        <div className={styles.infoRow}>
          <div className={styles.label}>회원 ID</div>
          <div className={styles.value}>{user?.login_id ?? "-"}</div>
        </div>

        <div className={styles.infoRow}>
          <div className={styles.label}>이름</div>
          <div className={styles.value}>
            <input
              className={styles.input}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={50}
              disabled={saving}
            />
          </div>
        </div>

        <div className={styles.infoRow}>
          <div className={styles.label}>이메일</div>
          <div className={styles.value}>
            <input
              className={styles.input}
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              maxLength={255}
              disabled={saving}
            />
          </div>
        </div>

        <div className={styles.infoRow}>
          <div className={styles.label}>아이디 생성일</div>
          <div className={styles.value}>{user?.created_at ?? "-"}</div>
        </div>
      </div>

      {confirmOpen && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <div className={styles.confirmTitle}>개인정보 수정</div>
            <div className={styles.confirmText}>수정하시겠습니까?</div>

            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={saveBasicInfo}
                disabled={saving}
              >
                {saving ? "수정 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
