import { clsx } from "clsx"
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./chip.module.css"

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  readonly icon?: IconName | undefined
  readonly hue?: string | undefined
  readonly pressed?: boolean
  readonly label: string
  readonly static?: boolean
  readonly size?: "regular" | "large"
  readonly trailing?: ReactNode
}

export function Chip({
  icon,
  hue = "currentColor",
  pressed = false,
  label,
  static: still = false,
  size = "regular",
  trailing,
  className,
  style,
  ...rest
}: ChipProps) {
  if (still)
    return (
      <span
        className={clsx(styles.chip, styles.still, !icon && styles.plain, className)}
        title={rest.title}
        data-pressed={pressed}
        style={{ ...style, "--chip-hue": hue } as CSSProperties}
      >
        {icon ? <Icon name={icon} size="sm" className={styles.icon} /> : null}
        <span className={styles.text}>{label}</span>
        {trailing}
      </span>
    )
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={pressed}
      className={clsx(
        styles.chip,
        size === "large" && styles.large,
        !icon && styles.plain,
        className,
      )}
      style={{ ...style, "--chip-hue": hue } as CSSProperties}
    >
      {icon ? <Icon name={icon} size="sm" className={styles.icon} /> : null}
      <span className={styles.text}>{label}</span>
      {trailing}
    </button>
  )
}
