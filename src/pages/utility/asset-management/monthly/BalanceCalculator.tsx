import { useEffect, useState, type KeyboardEvent } from "react";
import { Dialog } from "@mui/material";
import styles from "../AssetManagement.module.css";

type Operator = "+" | "-" | "×" | "÷";

type BalanceCalculatorProps = {
  accountName: string;
  initialValue: string;
  open: boolean;
  onClose: () => void;
  onApply: (value: string) => void;
};

const calculate = (left: number, right: number, operator: Operator) => {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "×") return left * right;
  return right === 0 ? null : left / right;
};

const displayNumber = (value: string) => {
  if (!value || value === "-") return value || "0";
  const [integer, decimal] = value.split(".");
  const formatted = Number(integer).toLocaleString("ko-KR");
  return decimal === undefined ? formatted : `${formatted}.${decimal}`;
};

// 월별 잔액 입력에 결과를 전달하는 기본 사칙연산 계산기
export default function BalanceCalculator({
  accountName,
  initialValue,
  open,
  onClose,
  onApply,
}: BalanceCalculatorProps) {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [replaceDisplay, setReplaceDisplay] = useState(true);
  const [completedFormula, setCompletedFormula] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDisplay(initialValue || "0");
    setStoredValue(null);
    setOperator(null);
    setReplaceDisplay(true);
    setCompletedFormula("");
    setError("");
  }, [initialValue, open]);

  const inputDigit = (digit: string) => {
    setError("");
    if (replaceDisplay && storedValue === null && operator === null) {
      setCompletedFormula("");
    }
    setDisplay((current) => {
      if (replaceDisplay || current === "0") return digit === "00" ? "0" : digit;
      return current.length >= 16 ? current : `${current}${digit}`;
    });
    setReplaceDisplay(false);
  };

  const inputDecimal = () => {
    setError("");
    if (replaceDisplay && storedValue === null && operator === null) {
      setCompletedFormula("");
    }
    setDisplay((current) => {
      if (replaceDisplay) return "0.";
      return current.includes(".") ? current : `${current}.`;
    });
    setReplaceDisplay(false);
  };

  const clear = () => {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setReplaceDisplay(true);
    setCompletedFormula("");
    setError("");
  };

  const backspace = () => {
    if (replaceDisplay) return;
    setDisplay((current) => current.length > 1 ? current.slice(0, -1) : "0");
    setError("");
  };

  const chooseOperator = (nextOperator: Operator) => {
    const current = Number(display);
    if (!Number.isFinite(current)) return;

    if (storedValue !== null && operator && !replaceDisplay) {
      const result = calculate(storedValue, current, operator);
      if (result === null) {
        setError("0으로 나눌 수 없습니다.");
        return;
      }
      setStoredValue(result);
      setDisplay(String(result));
    } else {
      setStoredValue(current);
    }
    setOperator(nextOperator);
    setReplaceDisplay(true);
    setCompletedFormula("");
    setError("");
  };

  const equals = () => {
    if (storedValue === null || !operator) return;
    const rightValue = Number(display);
    const result = calculate(storedValue, rightValue, operator);
    if (result === null || !Number.isFinite(result)) {
      setError("계산할 수 없는 값입니다.");
      return;
    }
    setCompletedFormula(`${displayNumber(String(storedValue))} ${operator} ${displayNumber(String(rightValue))} =`);
    setDisplay(String(result));
    setStoredValue(null);
    setOperator(null);
    setReplaceDisplay(true);
    setError("");
  };

  const apply = () => {
    const result = Math.round(Number(display));
    if (!Number.isSafeInteger(result) || result < 0) {
      setError("0 이상의 안전한 원 단위 금액만 적용할 수 있습니다.");
      return;
    }
    onApply(String(result));
    onClose();
  };

  const activeFormula = storedValue !== null && operator
    ? `${displayNumber(String(storedValue))} ${operator}${replaceDisplay ? "" : ` ${displayNumber(display)}`}`
    : completedFormula || displayNumber(display);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const { key } = event;
    const isCalculatorKey = /^[0-9]$/.test(key)
      || [".", ",", "+", "-", "*", "/", "Enter", "=", "Backspace", "Delete", "Escape", "c", "C"].includes(key);
    if (!isCalculatorKey) return;

    event.preventDefault();
    event.stopPropagation();

    if (/^[0-9]$/.test(key)) inputDigit(key);
    else if (key === "." || key === ",") inputDecimal();
    else if (key === "+") chooseOperator("+");
    else if (key === "-") chooseOperator("-");
    else if (key === "*") chooseOperator("×");
    else if (key === "/") chooseOperator("÷");
    else if (key === "Enter" || key === "=") equals();
    else if (key === "Backspace") backspace();
    else if (key === "Delete" || key.toLowerCase() === "c") clear();
    else if (key === "Escape") onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="balance-calculator-title"
      maxWidth="xs"
      fullWidth
      className={styles.calculatorDialog}
      onKeyDown={handleKeyDown}
    >
      <section className={styles.calculator}>
        <header>
          <div>
            <h2 id="balance-calculator-title">잔액 계산기</h2>
            <span>{accountName}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="계산기 닫기">×</button>
        </header>

        <div className={styles.calculatorDisplay} aria-live="polite">
          <small>{activeFormula}</small>
          <strong>{displayNumber(display)}</strong>
          <span>원</span>
        </div>

        {error && <p className={styles.calculatorError} role="alert">{error}</p>}

        <div className={styles.calculatorKeys}>
          <button type="button" className={styles.calculatorUtilityKey} onClick={clear}>C</button>
          <button type="button" className={styles.calculatorUtilityKey} onClick={backspace} aria-label="한 자리 지우기">⌫</button>
          <button type="button" className={styles.calculatorOperatorKey} onClick={() => chooseOperator("÷")}>÷</button>
          <button type="button" className={styles.calculatorOperatorKey} onClick={() => chooseOperator("×")}>×</button>
          <button type="button" onClick={() => inputDigit("7")}>7</button>
          <button type="button" onClick={() => inputDigit("8")}>8</button>
          <button type="button" onClick={() => inputDigit("9")}>9</button>
          <button type="button" className={styles.calculatorOperatorKey} onClick={() => chooseOperator("-")}>−</button>
          <button type="button" onClick={() => inputDigit("4")}>4</button>
          <button type="button" onClick={() => inputDigit("5")}>5</button>
          <button type="button" onClick={() => inputDigit("6")}>6</button>
          <button type="button" className={styles.calculatorOperatorKey} onClick={() => chooseOperator("+")}>+</button>
          <button type="button" onClick={() => inputDigit("1")}>1</button>
          <button type="button" onClick={() => inputDigit("2")}>2</button>
          <button type="button" onClick={() => inputDigit("3")}>3</button>
          <button type="button" className={styles.calculatorEqualsKey} onClick={equals}>=</button>
          <button type="button" className={styles.calculatorZeroKey} onClick={() => inputDigit("0")}>0</button>
          <button type="button" onClick={() => inputDigit("00")}>00</button>
          <button type="button" onClick={inputDecimal}>.</button>
        </div>

        <footer>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>취소</button>
          <button type="button" className={styles.primaryButton} onClick={apply}>적용</button>
        </footer>
      </section>
    </Dialog>
  );
}
