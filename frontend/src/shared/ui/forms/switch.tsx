import type { InputHTMLAttributes, Ref } from "react"
import { useInputModality } from "../../motion"
import styles from "./switch.module.css"

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  readonly inputRef?: Ref<HTMLInputElement>
  readonly label: string
  readonly onCheckedChange: (checked: boolean) => void
}

export function Switch({ label, inputRef, onCheckedChange, ...props }: SwitchProps) {
  const modality = useInputModality()
  return (
    <label
      className={styles.control}
      title={label}
      data-instant={modality.instant}
      onKeyDown={modality.onKeyDown}
      onPointerDown={modality.onPointerDown}
    >
      <input
        {...props}
        ref={inputRef}
        type="checkbox"
        role="switch"
        aria-checked={props.checked ?? false}
        className={styles.input}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span className={styles.rail} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className="visually-hidden">{label}</span>
    </label>
  )
}
