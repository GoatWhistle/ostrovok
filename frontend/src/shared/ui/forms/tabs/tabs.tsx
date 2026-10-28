import { clsx } from "clsx"
import { useId } from "react"
import { Button } from "../../primitives/button/button"
import type { IconName } from "../../primitives/icon/icon"
import styles from "./tabs.module.css"

export interface TabsProps<T extends string> {
  readonly label: string
  readonly value: T
  readonly onChange: (value: T) => void
  readonly compact?: boolean
  readonly options: readonly {
    readonly value: T
    readonly label: string
    readonly icon?: IconName
    readonly count?: number
    readonly id?: string
    readonly panelId?: string
  }[]
}

export function Tabs<T extends string>({
  label,
  value,
  onChange,
  options,
  compact = false,
}: TabsProps<T>) {
  const id = useId()
  return (
    <div className={clsx(styles.tabs, compact && styles.compact)} role="tablist" aria-label={label}>
      {options.map((option, index) => (
        <Button
          key={option.value}
          id={option.id ?? `${id}-${index}`}
          role="tab"
          aria-selected={value === option.value}
          aria-controls={option.panelId}
          tabIndex={value === option.value ? 0 : -1}
          variant="ghost"
          icon={option.icon}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const next = nextIndex(event.key, index, options.length)
            if (next === undefined) return
            event.preventDefault()
            const item = options[next]
            if (item) {
              onChange(item.value)
              document.getElementById(item.id ?? `${id}-${next}`)?.focus()
            }
          }}
        >
          {option.label}
          {option.count ? <span className={styles.count}>{option.count}</span> : null}
        </Button>
      ))}
    </div>
  )
}

function nextIndex(key: string, index: number, count: number): number | undefined {
  switch (key) {
    case "Home":
      return 0
    case "End":
      return count - 1
    case "ArrowRight":
      return (index + 1) % count
    case "ArrowLeft":
      return (index - 1 + count) % count
    default:
      return undefined
  }
}
