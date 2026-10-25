import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./state-tile.module.css"

export type StateTone = "neutral" | "danger" | "fact"

const TONE: Readonly<Record<StateTone, string | undefined>> = {
  neutral: styles.neutral,
  danger: styles.danger,
  fact: styles.fact,
}

export function StateTile({ icon, tone }: { readonly icon: IconName; readonly tone: StateTone }) {
  return (
    <span className={`${styles.tile} ${TONE[tone] ?? ""}`}>
      <span className={styles.ping} aria-hidden="true" />
      <Icon name={icon} size="xl" className={styles.icon} />
    </span>
  )
}
