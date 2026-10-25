import { useTranslation } from "../../../i18n"
import styles from "./confidence.module.css"

export interface ConfidenceProps {
  readonly value: number
}

const HIGH = 0.8
const MID = 0.5

function tierOf(value: number): "high" | "mid" | "low" {
  if (value >= HIGH) return "high"
  if (value >= MID) return "mid"
  return "low"
}

export function Confidence({ value }: ConfidenceProps) {
  const { t, i18n } = useTranslation()
  const tier = tierOf(value)
  const formatted = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return (
    <span className={styles.confidence} data-level={tier}>
      <span className={styles.bars} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{formatted}</span>
      <span className="visually-hidden">{t(`common:confidence.${tier}`)}</span>
    </span>
  )
}
