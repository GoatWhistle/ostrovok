import { NavLink } from "react-router"
import { useHealth } from "@/entities/health"
import { SiteSettings } from "@/pages/home/site-settings/site-settings"
import { useTranslation } from "@/shared/i18n"
import { BrandMark, StatusBadge, type StatusTone } from "@/shared/ui"
import styles from "./app-header.module.css"

export function AppHeader() {
  const { t } = useTranslation()
  const health = useHealth()
  const tone: StatusTone = health.isError ? "danger" : "info"
  return (
    <header className={styles.header}>
      <NavLink to="/" state={{ fresh: true }} viewTransition className={styles.brand ?? ""}>
        <BrandMark size="md" />
        <span className={styles.word}>{t("common:app.wordmark")}</span>
        <span className="visually-hidden">{t("common:app.tagline")}</span>
      </NavLink>
      <div className={styles.controls}>
        {health.isSuccess ? null : (
          <span className={styles.service} role="status">
            <StatusBadge tone={tone}>
              {health.isError ? t("explore:service.offline") : t("explore:service.loading")}
            </StatusBadge>
          </span>
        )}
        <SiteSettings />
      </div>
    </header>
  )
}
