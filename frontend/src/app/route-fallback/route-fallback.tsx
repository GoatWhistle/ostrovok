import { useTranslation } from "@/shared/i18n"
import { Skeleton } from "@/shared/ui"
import styles from "./route-fallback.module.css"

export function RouteFallback() {
  const { t } = useTranslation()
  return (
    <div className={styles.fallback} role="status" aria-label={t("common:state.loading")}>
      <div className={styles.reveal}>
        <Skeleton lines={2} className={styles.heading} />
        <div className={styles.panels}>
          <div className={styles.panel}>
            <Skeleton lines={3} />
            <Skeleton lines={3} />
            <Skeleton lines={3} />
          </div>
          <div className={styles.panel}>
            <Skeleton shape="block" />
            <Skeleton lines={4} />
          </div>
        </div>
      </div>
    </div>
  )
}
