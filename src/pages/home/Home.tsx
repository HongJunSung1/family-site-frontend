import Calendar from "../utility/Calendar";
import styles from "./Home.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <Calendar />
    </div>
  );
}
