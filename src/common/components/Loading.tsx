import styles from "./Loading.module.css";

type FamilyLoaderProps = {
  label?: string;
  className?: string;
};

type LoadingOverlayProps = {
  variant?: "family" | "calendar";
  label?: string;
};

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

export function PageLoading({ label = "로딩 중" }: Pick<FamilyLoaderProps, "label">) {
  return (
    <div className={styles.pageLoading}>
      <div className={styles.pageLoadingSurface}>
        <FamilyLoader label={label} />
      </div>
    </div>
  );
}

export function InlineLoadingDots({ label = "처리 중" }: Pick<FamilyLoaderProps, "label">) {
  return (
    <span className={styles.inlineDots} role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}

export function LoadingOverlay({ variant = "family", label = "로딩 중" }: LoadingOverlayProps) {
  return (
    <div
      className={[styles.overlay, variant === "calendar" ? styles.calendarOverlay : ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={label}
    >
      {variant === "calendar" ? <CalendarSkeleton /> : <FamilyLoader label={label} />}
    </div>
  );
}

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
