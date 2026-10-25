import { clsx } from "clsx"
import type { ReactNode } from "react"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./banner.module.css"

export type BannerTone = "info" | "warning" | "neutral" | "danger" | "success"

const TONE: Readonly<Record<BannerTone, string | undefined>> = {
  info: styles.info,
  warning: styles.warning,
  neutral: styles.neutral,
  danger: styles.danger,
  success: styles.success,
}

const TONE_ICON: Readonly<Record<BannerTone, IconName>> = {
  info: "info",
  warning: "alert",
  neutral: "unknown",
  danger: "rejected",
  success: "success",
}

export interface BannerProps {
  readonly tone: BannerTone
  readonly title: string
  readonly icon?: IconName
  readonly action?: ReactNode
  readonly className?: string | undefined
  readonly children?: ReactNode
}

export function Banner({ tone, title, icon, action, className, children }: BannerProps) {
  return (
    <div className={clsx(styles.banner, TONE[tone], className)} role="status">
      <Icon name={icon ?? TONE_ICON[tone]} size="md" className={styles.icon} />
      <div className={styles.body}>
        <strong className={styles.title}>{title}</strong>
        {children === undefined ? null : <div className={styles.text}>{children}</div>}
      </div>
      {action === undefined ? null : <div className={styles.action}>{action}</div>}
    </div>
  )
}
