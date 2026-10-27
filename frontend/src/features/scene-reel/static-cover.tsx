import { useTranslation } from "@/shared/i18n"
import styles from "./scene-reel.module.css"

export function StaticCover() {
  const { t } = useTranslation()
  return (
    <figure
      className={styles.reel}
      aria-label={t("explore:cover.title")}
      data-cover-static="true"
    />
  )
}
