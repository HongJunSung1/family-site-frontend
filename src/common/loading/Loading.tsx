import styles from "./Loading.module.css";

import { useStableLoading } from "./useStableLoading";

type FamilyLoaderProps = {
  label?: string;
  className?: string;
};

type LoadingOverlayProps = {
  active?: boolean;
  variant?: "family" | "calendar";
  label?: string;
  delayMs?: number;
  minimumVisibleMs?: number;
  fixed?: boolean;
};

// 가족 공유 서비스 공통 로딩 애니메이션
export function FamilyLoader({ label = "로딩 중", className = "" }: FamilyLoaderProps) {
  return (
    <div
      className={[styles.familyLoader, className].filter(Boolean).join(" ")}
      role="status"
      aria-label={label}
    >
      <div className={styles.nodeWrap} aria-hidden="true">
        <span className={styles.connector} />
        <span className={styles.node} />
        <span className={styles.node} />
        <span className={styles.node} />
        <span className={styles.node} />
      </div>
    </div>
  );
}

// 페이지 전체 전환 시 표시할 중앙 로딩 화면
export function PageLoading({ label = "로딩 중" }: Pick<FamilyLoaderProps, "label">) {
  return (
    <div className={styles.pageLoading}>
      <div className={styles.pageLoadingSurface}>
        <FamilyLoader label={label} />
      </div>
    </div>
  );
}

// 버튼이나 문장 안에서 쓰는 작은 점 로딩 표시
export function InlineLoadingDots({ label = "처리 중" }: Pick<FamilyLoaderProps, "label">) {
  return (
    <span className={styles.inlineDots} role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}

// 특정 영역 위에 덮어 표시하는 로딩 오버레이
export function LoadingOverlay({
  active = true,
  variant = "family",
  label = "로딩 중",
  delayMs = 200,
  minimumVisibleMs = 600,
  fixed = false,
}: LoadingOverlayProps) {
  const visibility = useStableLoading(active, { delayMs, minimumVisibleMs });
  if (!visibility.mounted) return null;

  return (
    <div
      className={[
        styles.overlay,
        variant === "calendar" ? styles.calendarOverlay : "",
        fixed ? styles.fixedOverlay : "",
        visibility.exiting ? styles.overlayExiting : styles.overlayVisible,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={label}
    >
      {variant === "calendar" ? <CalendarSkeleton /> : <FamilyLoader label={label} />}
    </div>
  );
}

// 캘린더 데이터 로딩 중 표시할 격자형 스켈레톤
function CalendarSkeleton() {
  return (
    <div className={styles.calendarSkeleton} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, weekIndex) => (
        <div className={styles.skeletonWeek} key={weekIndex}>
          {Array.from({ length: 7 }).map((__, dayIndex) => (
            <span className={styles.skeletonCell} key={`${weekIndex}-${dayIndex}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
