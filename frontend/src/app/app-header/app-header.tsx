import { NavLink } from "react-router"
import { useHealth } from "@/entities/health"
import { LocaleSwitch } from "@/features/locale-switch"
import { ThemeChoice } from "@/features/theme-switch"
import { useTranslation } from "@/shared/i18n"
import {
  BrandMark,
  Icon,
  SettingsMenu,
  SettingsRow,
  StatusBadge,
  type StatusTone,
} from "@/shared/ui"
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
      <nav className={styles.navigation} aria-label={t("explore:navigation.search")}>
        <NavLink to="/" end viewTransition className={styles.link ?? ""}>
          <Icon name="search" size="sm" />
          {t("explore:navigation.search")}
        </NavLink>
        <NavLink to="/hotelier" viewTransition className={styles.link ?? ""}>
          <Icon name="hotelier" size="sm" />
          {t("explore:navigation.hotelier")}
        </NavLink>
      </nav>
      <div className={styles.controls}>
        {health.isSuccess ? null : (
          <span className={styles.service} role="status">
            <StatusBadge tone={tone}>
              {health.isError ? t("explore:service.offline") : t("explore:service.loading")}
            </StatusBadge>
          </span>
        )}
        <SettingsMenu label={t("explore:landing.settings")}>
          <SettingsRow label={t("explore:landing.language")}>
            <LocaleSwitch />
          </SettingsRow>
          <SettingsRow label={t("explore:landing.theme")}>
            <ThemeChoice />
          </SettingsRow>
        </SettingsMenu>
      </div>
    </header>
  )
}
