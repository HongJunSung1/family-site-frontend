import styles from "./ComingSoon.module.css";

// 가계부 준비 중 화면
export default function HouseholdAccounts() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h1>가계부</h1>
          <p>준비 중입니다.</p>
        </div>
      </section>
    </main>
  );
}
