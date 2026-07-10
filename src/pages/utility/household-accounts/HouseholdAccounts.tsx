import { useState } from "react";
import { Input, InputField, TableInput, TextareaField } from "../../../common/input";
import styles from "./ComingSoon.module.css";

export default function HouseholdAccounts() {
  const [title, setTitle] = useState("7월 생활비");
  const [amount, setAmount] = useState("120000");
  const [category, setCategory] = useState("식비");
  const [memo, setMemo] = useState("마트 장보기, 아이 간식");
  const [tableValue, setTableValue] = useState("식비");

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.header}>
          <h1>가계부</h1>
          <p>준비 중입니다. 공통 input 테스트 화면입니다.</p>
        </div>

        <div className={styles.previewGrid}>
          <div className={styles.previewBlock}>
            <h2>일반 Input</h2>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="항목명을 입력하세요"
            />
          </div>

          <div className={styles.previewBlock}>
            <h2>라벨 위 InputField</h2>
            <InputField
              label="금액"
              labelPosition="top"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="numeric"
              helperText="라벨이 input 위에 나오는 기본 형태입니다."
            />
          </div>

          <div className={styles.previewBlock}>
            <h2>라벨 왼쪽 InputField</h2>
            <InputField
              label="분류"
              labelPosition="left"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              helperText="라벨이 input 왼쪽에 나오는 형태입니다."
            />
          </div>

          <div className={styles.previewBlock}>
            <h2>TextareaField</h2>
            <TextareaField
              label="메모"
              height={132}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              helperText="긴 내용을 입력할 때 사용하는 형태입니다."
            />
          </div>

          <div className={styles.previewBlock}>
            <h2>TableInput</h2>
            <div className={styles.tablePreview}>
              <div className={styles.tableHead}>분류</div>
              <div className={styles.tableHead}>금액</div>
              <div className={styles.tableCell}>
                <TableInput
                  value={tableValue}
                  onChange={(event) => setTableValue(event.target.value)}
                />
              </div>
              <div className={styles.tableCell}>
                <TableInput value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
