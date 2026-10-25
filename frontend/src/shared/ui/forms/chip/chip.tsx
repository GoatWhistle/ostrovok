import { clsx } from "clsx"
import type { ButtonHTMLAttributes, CSSProperties } from "react"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./chip.module.css"

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  readonly icon: IconName
  readonly hue: string
  readonly pressed?: boolean
  readonly label: string
  readonly static?: boolean
  readonly size?: "regular" | "large"
}

export function Chip({
  icon,
  hue,
  pressed = false,
  label,
  static: still = false,
  size = "regular",
  className,
  style,
  ...rest
}: ChipProps) {
  if (still)
    return (
      <span
        className={clsx(styles.chip, styles.still, className)}
        data-pressed={pressed}
        style={{ ...style, "--chip-hue": hue } as CSSProperties}
      >
        <span className={styles.dot}>
          <Icon name={icon} size="sm" />
        </span>
        <span className={styles.text}>{label}</span>
      </span>
    )
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={pressed}
      className={clsx(styles.chip, size === "large" && styles.large, className)}
      style={{ ...style, "--chip-hue": hue } as CSSProperties}
    >
      <span className={styles.dot}>
        <Icon name={icon} size="sm" />
      </span>
      <span className={styles.text}>{label}</span>
    </button>
  )
}
