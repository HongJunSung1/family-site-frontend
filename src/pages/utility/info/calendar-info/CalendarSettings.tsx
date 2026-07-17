import { useCallback, useEffect, useState } from "react";
import { hasAccessToken } from "../../../../api/client";
import {
  deleteMyColorPreset,
  getMyColorPresets,
  saveMyColorPresets,
  type FavoriteColorPreset,
} from "../../../../api/calendarApi";
import { AlertDialog, ConfirmDialog } from "../../../../common/dialog";
import { TableInput } from "../../../../common/input";
import { FamilyLoader } from "../../../../common/loading";
import styles from "./CalendarSettings.module.css";

type FavoriteColorRow = {
  tempId: string;
  slot?: number;
  color: string;
  title: string;
};

type AlertState = {
  open: boolean;
  title: string;
  message: string;
};

// 새 색상 설정 행 기본값 생성
const createEmptyRow = (): FavoriteColorRow => ({
  tempId: crypto.randomUUID(),
  color: "#3b82f6",
  title: "",
});

// 캘린더 자주 쓰는 색상 목록 관리 화면
export default function CalendarSettings() {
  const [colors, setColors] = useState<FavoriteColorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    title: "",
    message: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<FavoriteColorRow | null>(null);

  // 설정 화면 공통 안내창 표시
  const showAlert = useCallback((message: string, title = "안내") => {
    setAlertState({ open: true, title, message });
  }, []);

  // 서버 저장 자주 쓰는 색상 목록 조회
  const fetchColorPresets = useCallback(async () => {
    if (!hasAccessToken()) {
      showAlert("로그인 정보가 없습니다.");
      setLoading(false);
      return;
    }

    try {
      const data = await getMyColorPresets();

      if (!data.ok) {
        showAlert(data.message || "자주 쓰는 색상 정보를 불러오지 못했습니다.");
        return;
      }

      const rows =
        data.presets?.map((preset) => ({
          tempId: crypto.randomUUID(),
          slot: preset.slot,
          color: preset.color,
          title: preset.label || "",
        })) ?? [];

      setColors(rows);
    } catch (error) {
      console.error(error);
      showAlert("자주 쓰는 색상 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchColorPresets();
  }, [fetchColorPresets]);

  // 새 색상 입력 행 추가
  const handleAddColor = () => {
    if (colors.length >= 12) {
      showAlert("자주 쓰는 색상은 최대 12개까지 등록할 수 있습니다.");
      return;
    }

    setColors((prev) => [...prev, createEmptyRow()]);
  };

  // 색상 행의 색상값 또는 제목 변경
  const handleChangeColor = (tempId: string, field: "color" | "title", value: string) => {
    setColors((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    );
  };

  // 삭제 확인창 대상 색상 지정
  const handleDeleteColor = (row: FavoriteColorRow) => {
    setDeleteTarget(row);
  };

  // 삭제 확인 후 서버 또는 화면 상태 색상 제거
  const handleConfirmDeleteColor = async () => {
    if (!deleteTarget) return;

    const row = deleteTarget;
    setDeleteTarget(null);

    if (!row.slot) {
      setColors((prev) => prev.filter((item) => item.tempId !== row.tempId));
      return;
    }

    try {
      const data = await deleteMyColorPreset(row.slot);

      if (!data.ok) {
        showAlert(data.message || "색상 삭제에 실패했습니다.");
        return;
      }

      setColors((prev) => prev.filter((item) => item.tempId !== row.tempId));
    } catch (error) {
      console.error(error);
      showAlert("색상 삭제 중 오류가 발생했습니다.");
    }
  };

  // 현재 색상 목록 서버 저장
  const handleSave = async () => {
    const invalidTitle = colors.some((row) => row.title.trim() === "");

    if (!hasAccessToken()) {
      showAlert("로그인 정보가 없습니다.");
      return;
    }

    if (invalidTitle) {
      showAlert("색상 제목을 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      const data = await saveMyColorPresets(
        colors.map((row, index) => ({
          slot: row.slot ?? index + 1,
          color: row.color,
          label: row.title.trim(),
        })) satisfies FavoriteColorPreset[]
      );

      if (!data.ok) {
        showAlert(data.message || "자주 쓰는 색상 저장에 실패했습니다.");
        return;
      }

      showAlert(data.message || "자주 쓰는 색상이 저장되었습니다.");
      fetchColorPresets();
    } catch (error) {
      console.error(error);
      showAlert("자주 쓰는 색상 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const dialogs = (
    <>
      <AlertDialog
        open={alertState.open}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState((prev) => ({ ...prev, open: false }))}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="삭제 확인"
        message="이 색상을 삭제하시겠습니까?"
        cancelLabel="아니요"
        confirmLabel="예"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteColor}
      />
    </>
  );

  if (loading) {
    return (
      <>
        <div className={styles.card}>
          <div className={styles.loadingState}>
            <FamilyLoader label="캘린더 환경설정 로딩 중" />
          </div>
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.sectionTitle}>캘린더 환경설정</h3>
          <p className={styles.description}>
            캘린더 입력 시 자주 사용하는 색상을 미리 등록합니다.
          </p>
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleAddColor}
            disabled={saving}
          >
            색상 추가
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "67%" }} />
            <col style={{ width: "15%" }} />
          </colgroup>

          <thead>
            <tr>
              <th>색상</th>
              <th>색상 제목</th>
              <th>삭제</th>
            </tr>
          </thead>

          <tbody>
            {colors.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.emptyCell}>
                  등록된 색상이 없습니다.
                </td>
              </tr>
            ) : (
              colors.map((row) => (
                <tr key={row.tempId}>
                  <td>
                    <div className={styles.colorCell}>
                      <input
                        type="color"
                        value={row.color}
                        className={styles.colorInput}
                        onChange={(e) => handleChangeColor(row.tempId, "color", e.target.value)}
                        disabled={saving}
                      />
                      <span className={styles.colorText}>{row.color}</span>
                    </div>
                  </td>

                  <td>
                    <TableInput
                      type="text"
                      value={row.title}
                      placeholder="예: 가족 일정, 병원, 회사"
                      onChange={(e) => handleChangeColor(row.tempId, "title", e.target.value)}
                      disabled={saving}
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => handleDeleteColor(row)}
                      disabled={saving}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialogs}
    </div>
  );
}
