import { useCallback, useEffect, useState } from "react";
import {
  getMyColorPresets,
  saveMyColorPresets,
  type FavoriteColorPreset,
} from "../../../../api/calendarApi";
import { hasAccessToken } from "../../../../api/client";

export type { FavoriteColorPreset } from "../../../../api/calendarApi";

export function useFavoriteColors() {
  const [favoriteColors, setFavoriteColors] = useState<FavoriteColorPreset[]>([]);
  const [savingColor, setSavingColor] = useState(false);

  useEffect(() => {
    const fetchFavoriteColors = async () => {
      if (!hasAccessToken()) return;

      try {
        const data = await getMyColorPresets();

        if (!data.ok) return;

        setFavoriteColors(data.presets ?? []);
      } catch (err) {
        console.error("자주 쓰는 색상 조회 실패", err);
      }
    };

    fetchFavoriteColors();
  }, []);

  const saveFavoriteColor = useCallback(
    async (color: string, rawLabel: string) => {
      const label = rawLabel.trim();

      if (!label) {
        alert("색상 이름을 입력해주세요.");
        return false;
      }

      if (!hasAccessToken()) return false;

      const nextSlot =
        Array.from({ length: 12 }, (_, i) => i + 1).find(
          (slot) => !favoriteColors.some((c) => c.slot === slot)
        ) ?? null;

      if (!nextSlot) {
        alert("자주 쓰는 색상은 최대 12개까지 저장할 수 있습니다.");
        return false;
      }

      const nextPresets = [
        ...favoriteColors,
        {
          slot: nextSlot,
          color,
          label,
        },
      ].sort((a, b) => a.slot - b.slot);

      setSavingColor(true);

      try {
        const data = await saveMyColorPresets(nextPresets);

        if (!data.ok) {
          alert(data.message || "색상 저장에 실패했습니다.");
          return false;
        }

        setFavoriteColors(nextPresets);
        return true;
      } catch (err) {
        console.error("색상 저장 실패", err);
        alert("색상 저장 중 오류가 발생했습니다.");
        return false;
      } finally {
        setSavingColor(false);
      }
    },
    [favoriteColors]
  );

  const deleteFavoriteColor = useCallback(
    async (preset: FavoriteColorPreset) => {
      const ok = window.confirm(
        `"${preset.label?.trim() || preset.color}" 색상을 삭제하시겠습니까?`
      );

      if (!ok) return false;

      if (!hasAccessToken()) return false;

      const nextPresets = favoriteColors
        .filter((c) => c.slot !== preset.slot)
        .map((c, index) => ({
          ...c,
          slot: index + 1,
        }));

      try {
        const data = await saveMyColorPresets(nextPresets);

        if (!data.ok) {
          alert(data.message || "색상 삭제에 실패했습니다.");
          return false;
        }

        setFavoriteColors(nextPresets);
        return true;
      } catch (err) {
        console.error("색상 삭제 실패", err);
        alert("색상 삭제 중 오류가 발생했습니다.");
        return false;
      }
    },
    [favoriteColors]
  );

  return {
    favoriteColors,
    savingColor,
    saveFavoriteColor,
    deleteFavoriteColor,
  };
}
