import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type DragOffset = {
  x: number;
  y: number;
};

// 모달 드래그 이동과 화면 밖 이탈 방지 처리
export function useDraggableModal() {
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement | null>(null);

  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  // 드래그 위치를 현재 화면 안으로 제한
  const clampDragOffset = useCallback((nextX: number, nextY: number) => {
    const el = modalRef.current;
    if (!el) return { x: nextX, y: nextY };

    const rect = el.getBoundingClientRect();
    const modalWidth = rect.width;
    const modalHeight = rect.height;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const baseLeft = (vw - modalWidth) / 2;
    const baseTop = (vh - modalHeight) / 2;

    const minX = -baseLeft;
    const maxX = vw - modalWidth - baseLeft;

    const minY = -baseTop;
    const maxY = vh - modalHeight - baseTop;

    return {
      x: Math.min(Math.max(nextX, minX), maxX),
      y: Math.min(Math.max(nextY, minY), maxY),
    };
  }, []);

  // 입력 컨트롤이 아닌 영역에서만 드래그 시작
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    if (
      target.closest("button, input, textarea, select, option, label") ||
      target.closest(".MuiSwitch-root")
    ) {
      return;
    }

    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: dragOffset.x,
      originY: dragOffset.y,
    };

    e.preventDefault();
  };

  useEffect(() => {
    // 마우스 이동량을 모달 위치에 반영
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;

      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      const nextX = dragRef.current.originX + dx;
      const nextY = dragRef.current.originY + dy;

      setDragOffset(clampDragOffset(nextX, nextY));
    };

    // 마우스 버튼 해제 시 드래그 종료
    const handleMouseUp = () => {
      dragRef.current.dragging = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [clampDragOffset]);

  useLayoutEffect(() => {
    // 화면 크기 변경 시 모달 위치 재보정
    const handleResize = () => {
      setDragOffset((prev) => clampDragOffset(prev.x, prev.y));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampDragOffset]);

  return {
    dragOffset,
    modalRef,
    handleDragStart,
  };
}
