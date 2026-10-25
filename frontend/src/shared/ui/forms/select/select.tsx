import { clsx } from "clsx"
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { usePresence } from "../../../motion/use-presence"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./select.module.css"

export interface SelectOption<T extends string> {
  readonly value: T
  readonly label: string
  readonly icon?: IconName
}

export interface SelectProps<T extends string> {
  readonly label: string
  readonly options: readonly SelectOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  readonly icon?: IconName
  readonly size?: "regular" | "compact"
  readonly className?: string | undefined
}

const NAVIGATION = new Set(["ArrowDown", "ArrowUp", "Home", "End"])

function nextIndex(key: string, current: number, size: number): number {
  if (key === "Home") return 0
  if (key === "End") return size - 1
  if (key === "ArrowUp") return current <= 0 ? size - 1 : current - 1
  return (current + 1) % size
}

export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
  icon,
  size = "regular",
  className,
}: SelectProps<T>) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const presence = usePresence(open)
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const [active, setActive] = useState(selectedIndex)
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  const show = () => {
    setActive(selectedIndex)
    setOpen(true)
  }
  const pick = (index: number) => {
    const option = options[index]
    if (option) onChange(option.value)
    setOpen(false)
    trigger.current?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (NAVIGATION.has(event.key)) {
      event.preventDefault()
      if (!open) show()
      else setActive((current) => nextIndex(event.key, current, options.length))
      return
    }
    if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      pick(active)
    }
    if (event.key === "Escape") setOpen(false)
  }

  return (
    <div ref={root} className={clsx(styles.select, className)} data-size={size}>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {icon ? <Icon name={icon} size="sm" className={styles.prefixIcon} /> : null}
        <span className={size === "compact" ? "visually-hidden" : styles.prefix}>{label}</span>
        <span className={styles.value}>{selected?.label}</span>
        <Icon name="chevron-down" size="sm" className={styles.chevron} />
      </button>
      {presence.mounted ? (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className={styles.layer}
          data-state={presence.state}
          onTransitionEnd={presence.onTransitionEnd}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              data-active={index === active || undefined}
              className={styles.option}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
              onKeyDown={(event) => event.key === "Enter" && pick(index)}
              onPointerEnter={() => setActive(index)}
            >
              {option.icon ? <Icon name={option.icon} size="sm" /> : null}
              <span>{option.label}</span>
              <Icon name="check" size="sm" className={styles.check} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
