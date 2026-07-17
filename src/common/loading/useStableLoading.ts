import { useEffect, useRef, useState } from "react";

export type StableLoadingPhase = "hidden" | "visible" | "exiting";

type StableLoadingOptions = {
  delayMs?: number;
  minimumVisibleMs?: number;
  exitDurationMs?: number;
};

// 짧은 로딩은 숨기고, 표시된 로딩은 최소 시간 동안 유지
export function useStableLoading(
  active: boolean,
  {
    delayMs = 200,
    minimumVisibleMs = 600,
    exitDurationMs = 160,
  }: StableLoadingOptions = {}
) {
  const initialPhase: StableLoadingPhase = active && delayMs === 0 ? "visible" : "hidden";
  const [phase, setPhase] = useState<StableLoadingPhase>(initialPhase);
  const phaseRef = useRef<StableLoadingPhase>(initialPhase);
  const shownAtRef = useRef(0);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
      showTimerRef.current = null;
      hideTimerRef.current = null;
      exitTimerRef.current = null;
    };
    const updatePhase = (nextPhase: StableLoadingPhase) => {
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
    };

    clearTimers();

    if (active) {
      if (phaseRef.current === "visible") {
        if (shownAtRef.current === 0) shownAtRef.current = Date.now();
        return clearTimers;
      }

      if (phaseRef.current === "exiting") {
        shownAtRef.current = Date.now();
        updatePhase("visible");
        return clearTimers;
      }

      showTimerRef.current = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        updatePhase("visible");
        showTimerRef.current = null;
      }, Math.max(0, delayMs));
      return clearTimers;
    }

    if (phaseRef.current === "hidden") return clearTimers;

    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, minimumVisibleMs - elapsed);
    hideTimerRef.current = window.setTimeout(() => {
      updatePhase("exiting");
      hideTimerRef.current = null;
      exitTimerRef.current = window.setTimeout(() => {
        updatePhase("hidden");
        exitTimerRef.current = null;
      }, Math.max(0, exitDurationMs));
    }, remaining);

    return clearTimers;
  }, [active, delayMs, exitDurationMs, minimumVisibleMs]);

  return {
    phase,
    mounted: phase !== "hidden",
    exiting: phase === "exiting",
  };
}
