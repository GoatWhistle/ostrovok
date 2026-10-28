import { Button } from "../primitives/button/button"
import styles from "./number-field.module.css"
import { TextField, type TextFieldProps } from "./text-field/text-field"

export interface NumberFieldProps extends Omit<TextFieldProps, "value" | "onChange" | "type"> {
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly decreaseLabel: string
  readonly increaseLabel: string
  readonly integer?: boolean
}

export function NumberField({
  value,
  onValueChange,
  decreaseLabel,
  increaseLabel,
  integer = false,
  disabled,
  ...props
}: NumberFieldProps) {
  const parsed = value.trim() ? Number(value.replace(",", ".")) : 0
  const current = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  const change = (delta: number) =>
    onValueChange(String(Math.max(0, (integer ? Math.trunc(current) : current) + delta)))
  return (
    <div className={styles.field}>
      <TextField
        {...props}
        value={value}
        disabled={disabled}
        inputMode={integer ? "numeric" : "decimal"}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Button
        icon="minus"
        iconOnly
        title={decreaseLabel}
        variant="outline"
        disabled={disabled || current <= 0}
        onClick={() => change(-1)}
      >
        {decreaseLabel}
      </Button>
      <Button
        icon="plus"
        iconOnly
        title={increaseLabel}
        variant="outline"
        disabled={disabled}
        onClick={() => change(1)}
      >
        {increaseLabel}
      </Button>
    </div>
  )
}
