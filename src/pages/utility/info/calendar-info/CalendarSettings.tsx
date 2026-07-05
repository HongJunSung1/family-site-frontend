// 캘린더 환경설정
import { useEffect, useState } from "react";
import styles from "./CalendarSettings.module.css";

type FavoriteColorRow = {
  tempId: string;
  slot?: number;
  color: string;
  title: string;
};

type ColorPresetResponseItem = {
  slot: number;
  color: string;
  label: string | null;
};

type GetColorPresetsResponse = {
  ok: boolean;
  presets?: ColorPresetResponseItem[];
  message?: string;
};

type SaveColorPresetsResponse = {
  ok: boolean;
  message?: string;
};

const API_BASE = import.meta.env.VITE_API_URL || "";

const createEmptyRow = (): FavoriteColorRow => ({
  tempId: crypto.randomUUID(),
  color: "#3b82f6",
  title: "",
});

export default function CalendarSettings() {
  const [colors, setColors] = useState<FavoriteColorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchColorPresets = async () => {
    const token = localStorage.getItem("accessToken");    

    if (!token) {
      alert("로그인 정보가 없습니다.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/calendars/getMyColorPresets`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json()) as GetColorPresetsResponse;

      if (!res.ok || !data.ok) {
        alert(data.message || "자주 쓰는 색상 정보를 불러오지 못했습니다.");
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
      alert("자주 쓰는 색상 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColorPresets();
  }, []);

  const handleAddColor = () => {
    if (colors.length >= 12) {
      alert("자주 쓰는 색상은 최대 12개까지 등록할 수 있습니다.");
      return;
    }

    setColors((prev) => [...prev, createEmptyRow()]);
  };

  const handleChangeColor = (
    tempId: string,
    field: "color" | "title",
    value: string
  ) => {
    setColors((prev) =>
      prev.map((row) =>
        row.tempId === tempId ? { ...row, [field]: value } : row
      )
    );
  };

  const handleDeleteColor = async (row: FavoriteColorRow) => {
    if (!confirm("이 색상을 삭제하시겠습니까?")) {
        return;
    }

    // 아직 저장되지 않은 신규 행은 화면에서만 삭제
    if (!row.slot) {
        setColors((prev) => prev.filter((item) => item.tempId !== row.tempId));
        return;
    }

    const token = localStorage.getItem("accessToken");  
    try {
        const res = await fetch(`${API_BASE}/api/calendars/deleteMyColorPreset`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                slot: row.slot,
            }),
        });
        const data = (await res.json()) as {
            ok: boolean;
            message?: string;
        };

        if (!res.ok || !data.ok) {
            alert(data.message || "색상 삭제에 실패했습니다.");
            return;
        }

        setColors((prev) => prev.filter((item) => item.tempId !== row.tempId));
    } catch (error) {
        console.error(error);
        alert("색상 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleSave = async () => {
    const invalidTitle = colors.some((row) => row.title.trim() === "");
    const token = localStorage.getItem("accessToken");

    if(!token){
        alert("로그인 정보가 없습니다.");
        return;
    }

    if (invalidTitle) {
      alert("색상 제목을 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${API_BASE}/api/calendars/saveMyColorPresets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          presets: colors.map((row) => ({
            color: row.color,
            label: row.title.trim(),
          })),
        }),
      });

      const data = (await res.json()) as SaveColorPresetsResponse;

      if (!res.ok || !data.ok) {
        alert(data.message || "자주 쓰는 색상 저장에 실패했습니다.");
        return;
      }

      alert(data.message || "자주 쓰는 색상이 저장되었습니다.");
      fetchColorPresets();
    } catch (error) {
      console.error(error);
      alert("자주 쓰는 색상 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.card}>불러오는 중...</div>;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.sectionTitle}>캘린더 환경설정</h3>
          <p className={styles.description}>
            캘린더 입력 시 자주 사용할 색상을 미리 등록합니다.
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
                        onChange={(e) =>
                          handleChangeColor(row.tempId, "color", e.target.value)
                        }
                        disabled={saving}
                      />
                      <span className={styles.colorText}>{row.color}</span>
                    </div>
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.title}
                      className={styles.textInput}
                      placeholder="예: 가족 일정, 병원, 회사"
                      onChange={(e) =>
                        handleChangeColor(row.tempId, "title", e.target.value)
                      }
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
    </div>
  );
}