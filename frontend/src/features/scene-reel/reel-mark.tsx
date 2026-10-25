import { useTranslation } from "@/shared/i18n"
import styles from "./reel-mark.module.css"
import type { ReelMark as ReelMarkData } from "./reel-marks"

export function ReelMark({ mark }: { readonly mark: ReelMarkData }) {
  const { t } = useTranslation()
  return (
    <span className={styles.mark}>
      <span className={styles.label}>{t(mark.name)}</span>
      <span className={styles.stem} />
      <span className={styles.dot} />
    </span>
  )
}
