import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import styles from "./Input.module.css";

type InputVariant = "default" | "table";

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  variant?: InputVariant;
  invalid?: boolean;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

type InputFieldProps = BaseInputProps & {
  label?: string;
  labelPosition?: "top" | "left";
  helperText?: string;
  error?: string;
  requiredMark?: boolean;
};

type TableInputProps = Omit<BaseInputProps, "variant">;

type TextareaInputProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  height?: number | string;
};

type TextareaFieldProps = TextareaInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  requiredMark?: boolean;
};

export function Input({
  variant = "default",
  invalid = false,
  leftSlot,
  rightSlot,
  className = "",
  ...props
}: BaseInputProps) {
  const hasSlot = leftSlot || rightSlot;

  if (hasSlot) {
    return (
      <span
        className={[
          styles.controlWrap,
          styles[variant],
          invalid ? styles.invalid : "",
          props.disabled ? styles.disabled : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {leftSlot && <span className={styles.slot}>{leftSlot}</span>}
        <input className={styles.controlInner} aria-invalid={invalid || undefined} {...props} />
        {rightSlot && <span className={styles.slot}>{rightSlot}</span>}
      </span>
    );
  }

  return (
    <input
      className={[
        styles.control,
        styles[variant],
        invalid ? styles.invalid : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function InputField({
  label,
  labelPosition = "top",
  helperText,
  error,
  requiredMark = false,
  id,
  ...props
}: InputFieldProps) {
  const inputId = id ?? props.name;
  const message = error || helperText;

  return (
    <label
      className={[
        styles.field,
        labelPosition === "left" ? styles.fieldHorizontal : "",
      ]
        .filter(Boolean)
        .join(" ")}
      htmlFor={inputId}
    >
      {label && (
        <span className={styles.label}>
          {label}
          {requiredMark && <span className={styles.required}>*</span>}
        </span>
      )}
      <span className={styles.fieldControl}>
        <Input id={inputId} invalid={!!error} {...props} />
        {message && (
          <span className={error ? styles.errorText : styles.helperText}>{message}</span>
        )}
      </span>
    </label>
  );
}

export function TableInput(props: TableInputProps) {
  return <Input variant="table" {...props} />;
}

export function TextareaInput({
  invalid = false,
  height,
  className = "",
  style,
  ...props
}: TextareaInputProps) {
  const textareaHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <textarea
      className={[
        styles.textarea,
        invalid ? styles.invalid : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={invalid || undefined}
      style={{
        ...style,
        ...(textareaHeight
          ? {
              height: textareaHeight,
              minHeight: textareaHeight,
              maxHeight: textareaHeight,
            }
          : {}),
      }}
      {...props}
    />
  );
}

export function TextareaField({
  label,
  helperText,
  error,
  requiredMark = false,
  id,
  ...props
}: TextareaFieldProps) {
  const inputId = id ?? props.name;
  const message = error || helperText;

  return (
    <label className={styles.field} htmlFor={inputId}>
      {label && (
        <span className={styles.label}>
          {label}
          {requiredMark && <span className={styles.required}>*</span>}
        </span>
      )}
      <TextareaInput id={inputId} invalid={!!error} {...props} />
      {message && (
        <span className={error ? styles.errorText : styles.helperText}>{message}</span>
      )}
    </label>
  );
}
