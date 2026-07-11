import Calendar from "../utility/Calendar";
import styles from "./Home.module.css";

// 홈 화면의 메인 캘린더 표시
export default function Home() {
  return (
    <div className={styles.page}>
      <Calendar />
    </div>
  );
}
