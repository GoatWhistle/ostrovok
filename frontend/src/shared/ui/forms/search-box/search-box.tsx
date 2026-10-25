import type { KeyboardEvent, ReactNode } from "react"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./search-box.module.css"

export interface SearchBoxProps {
  readonly label: string
  readonly placeholder: string
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly maxLength?: number
  readonly icon?: IconName | undefined
  readonly describedBy?: string | undefined
  readonly actions?: ReactNode
}

function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}

export function SearchBox({
  label,
  placeholder,
  value,
  onValueChange,
  maxLength,
  icon,
  describedBy,
  actions,
}: SearchBoxProps) {
  return (
    <div className={styles.box}>
      <label className={styles.field}>
        <span className="visually-hidden">{label}</span>
        {icon === undefined ? null : <Icon name={icon} size="md" className={styles.icon} />}
        <textarea
          className={styles.input}
          placeholder={placeholder}
          value={value}
          rows={1}
          maxLength={maxLength}
          aria-describedby={describedBy}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={submitOnEnter}
        />
      </label>
      {actions === undefined ? null : <span className={styles.actions}>{actions}</span>}
    </div>
  )
}
