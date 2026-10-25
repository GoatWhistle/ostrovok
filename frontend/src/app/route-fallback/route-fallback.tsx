import { useTranslation } from "@/shared/i18n"
import { JourneyLoader } from "@/shared/ui"
import styles from "./route-fallback.module.css"

export function RouteFallback() {
  const { t } = useTranslation()
  return (
    <div className={styles.fallback}>
      <JourneyLoader title={t("common:state.loading")} />
    </div>
  )
}
