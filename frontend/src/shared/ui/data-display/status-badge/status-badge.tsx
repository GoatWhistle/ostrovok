import { clsx } from "clsx"
import type { ReactNode } from "react"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./status-badge.module.css"

export type StatusTone =
  | "success"
  | "danger"
  | "warning"
  | "conflict"
  | "info"
  | "neutral"
  | "fact"
  | "stale"

const TONE: Readonly<Record<StatusTone, string | undefined>> = {
  success: styles.success,
  danger: styles.danger,
  warning: styles.warning,
  conflict: styles.conflict,
  info: styles.info,
  neutral: styles.neutral,
  fact: styles.fact,
  stale: styles.stale,
}

const TONE_ICON: Readonly<Record<StatusTone, IconName>> = {
  success: "success",
  danger: "rejected",
  warning: "partial",
  conflict: "alert",
  info: "pending",
  neutral: "unknown",
  fact: "map",
  stale: "stale",
}

export interface StatusBadgeProps {
  readonly tone: StatusTone
  readonly icon?: IconName
  readonly className?: string | undefined
  readonly children: ReactNode
}

export function StatusBadge({ tone, icon, className, children }: StatusBadgeProps) {
  return (
    <span className={clsx(styles.badge, TONE[tone], className)}>
      <Icon name={icon ?? TONE_ICON[tone]} size="sm" className={styles.icon} />
      <span>{children}</span>
    </span>
  )
}
