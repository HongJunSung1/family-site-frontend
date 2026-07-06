import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { CSSProperties } from "react";
import type { FavoriteColorPreset } from "../hooks/useFavoriteColors";
import styles from "./EventModal.module.css";

type EventColorPickerProps = {
  color: string;
  favoriteColors: FavoriteColorPreset[];
  savingColor: boolean;
  onColorChange: (color: string) => void;
  onSaveFavoriteColor: (color: string, label: string) => Promise<boolean>;
  onDeleteFavoriteColor: (preset: FavoriteColorPreset) => Promise<boolean>;
};

export function EventColorPicker({
  color,
  favoriteColors,
  savingColor,
  onColorChange,
  onSaveFavoriteColor,
  onDeleteFavoriteColor,
}: EventColorPickerProps) {
  const [favoriteColorOpen, setFavoriteColorOpen] = useState(false);
  const [addColorOpen, setAddColorOpen] = useState(false);
  const [newColor, setNewColor] = useState(color || "#3b82f6");
  const [newColorLabel, setNewColorLabel] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const addColorRef = useRef<HTMLDivElement>(null);
  const addColorPopoverRef = useRef<HTMLDivElement>(null);

  const [favoriteMenuStyle, setFavoriteMenuStyle] = useState<CSSProperties>({});
  const [addColorPopoverStyle, setAddColorPopoverStyle] = useState<CSSProperties>({});
  const [addColorPopoverOpenAbove, setAddColorPopoverOpenAbove] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !dropdownMenuRef.current?.contains(target)
      ) {
        setFavoriteColorOpen(false);
      }

      if (
        addColorRef.current &&
        !addColorRef.current.contains(target) &&
        !addColorPopoverRef.current?.contains(target)
      ) {
        setAddColorOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useLayoutEffect(() => {
    const updateFloatingPositions = () => {
      if (favoriteColorOpen && dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const gap = 4;
        const viewportPadding = 12;
        const menuHeight = Math.min(dropdownMenuRef.current?.scrollHeight ?? 185, 185);
        const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
        const availableAbove = rect.top - viewportPadding;
        const openAbove = availableBelow < menuHeight && availableAbove > availableBelow;
        const maxHeight = Math.max(
          80,
          Math.min(menuHeight, openAbove ? availableAbove - gap : availableBelow - gap)
        );

        setFavoriteMenuStyle({
          top: openAbove
            ? Math.max(viewportPadding, rect.top - gap - maxHeight - 12)
            : rect.bottom + gap,
          left: rect.left,
          width: rect.width,
          maxHeight,
        });
      }

      if (addColorOpen && addColorRef.current) {
        const rect = addColorRef.current.getBoundingClientRect();
        const gap = 10;
        const viewportPadding = 12;
        const popoverWidth = Math.min(430, window.innerWidth - 24);
        const popoverHeight =
          addColorPopoverRef.current?.scrollHeight ||
          addColorPopoverRef.current?.getBoundingClientRect().height ||
          170;
        const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
        const availableAbove = rect.top - viewportPadding;
        const openAbove = availableBelow < popoverHeight && availableAbove > availableBelow;
        const maxHeight = Math.max(
          120,
          Math.min(popoverHeight, openAbove ? availableAbove - gap : availableBelow - gap)
        );
        const left = Math.min(
          Math.max(12, rect.right - popoverWidth),
          window.innerWidth - popoverWidth - 12
        );

        setAddColorPopoverOpenAbove(openAbove);
        setAddColorPopoverStyle({
          top: openAbove
            ? Math.max(viewportPadding, rect.top - gap - maxHeight)
            : rect.bottom + gap,
          left,
          width: popoverWidth,
          maxHeight,
          overflowY: popoverHeight > maxHeight ? "auto" : undefined,
        });
      }
    };

    updateFloatingPositions();

    window.addEventListener("resize", updateFloatingPositions);
    window.addEventListener("scroll", updateFloatingPositions, true);

    return () => {
      window.removeEventListener("resize", updateFloatingPositions);
      window.removeEventListener("scroll", updateFloatingPositions, true);
    };
  }, [addColorOpen, favoriteColorOpen]);

  const selectedFavoriteLabel =
    favoriteColors.find((c) => c.color.toLowerCase() === color.toLowerCase())?.label ||
    "자주 쓰는 색상 선택";

  const handleSave = async () => {
    const saved = await onSaveFavoriteColor(newColor, newColorLabel);
    if (!saved) return;

    onColorChange(newColor);
    setNewColorLabel("");
    setAddColorOpen(false);
  };

  return (
    <div className={styles.colorArea}>
      <input
        type="color"
        value={color}
        onChange={(e) => onColorChange(e.target.value)}
        className={styles.colorInput}
      />

      {favoriteColors.length > 0 && (
        <div ref={dropdownRef} className={styles.favoriteColorDropdown}>
          <button
            type="button"
            className={styles.favoriteColorTrigger}
            onClick={() => setFavoriteColorOpen((prev) => !prev)}
          >
            <span className={styles.favoriteColorDot} style={{ backgroundColor: color }} />
            <span>{selectedFavoriteLabel}</span>
            <span className={styles.dropdownArrow}>▾</span>
          </button>

          {favoriteColorOpen &&
            createPortal(
              <div
                ref={dropdownMenuRef}
                className={[styles.favoriteColorMenu, styles.favoriteColorMenuFloating].join(" ")}
                style={favoriteMenuStyle}
              >
              {favoriteColors.map((preset) => (
                <div
                  key={preset.slot}
                  className={styles.favoriteColorOption}
                  onClick={() => {
                    onColorChange(preset.color);
                    setFavoriteColorOpen(false);
                  }}
                >
                  <span
                    className={styles.favoriteColorDot}
                    style={{ backgroundColor: preset.color }}
                  />

                  <span className={styles.favoriteColorLabel}>
                    {preset.label?.trim() || preset.color}
                  </span>

                  <button
                    type="button"
                    className={styles.favoriteColorDeleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFavoriteColor(preset);
                    }}
                    title="색상 삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
              </div>,
              document.body
            )}
        </div>
      )}

      <div ref={addColorRef} className={styles.addColorBox}>
        <button
          type="button"
          className={styles.addColorButton}
          onClick={() => {
            setNewColor(color || "#3b82f6");
            setAddColorOpen((prev) => !prev);
          }}
        >
          <span className={styles.addColorPlus}>+</span>
        </button>

        {addColorOpen &&
          createPortal(
            <div
              ref={addColorPopoverRef}
              className={[
                styles.addColorPopover,
                styles.addColorPopoverFloating,
                addColorPopoverOpenAbove ? styles.addColorPopoverOpenAbove : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={addColorPopoverStyle}
            >
            <div className={styles.addColorHeader}>
              <div className={styles.addColorTitle}>새 색상 추가</div>

              <div className={styles.addColorActions}>
                <button
                  type="button"
                  className={styles.addColorCancelButton}
                  onClick={() => {
                    setNewColorLabel("");
                    setAddColorOpen(false);
                  }}
                >
                  취소
                </button>

                <button
                  type="button"
                  className={styles.addColorSaveButton}
                  disabled={savingColor || !newColorLabel.trim()}
                  onClick={handleSave}
                >
                  저장
                </button>
              </div>
            </div>

            <div className={styles.addColorRow}>
              <label className={styles.addColorLabel}>색상</label>

              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className={styles.addColorInput}
              />

              <input
                type="text"
                value={newColorLabel}
                maxLength={20}
                onChange={(e) => setNewColorLabel(e.target.value)}
                placeholder="색상 이름 입력"
                className={styles.addColorNameInput}
              />
            </div>

            <div className={styles.addColorCount}>{newColorLabel.length} / 20</div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
