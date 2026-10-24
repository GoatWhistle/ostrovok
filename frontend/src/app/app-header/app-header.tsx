import { NavLink } from "react-router"
import { useHealth } from "@/entities/health"
import { LocaleSwitch } from "@/features/locale-switch"
import { ThemeSwitch } from "@/features/theme-switch"
import { useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import styles from "./app-header.module.css"
export function AppHeader() {
  const { t } = useTranslation()
  const health = useHealth()
  return (
    <header className={styles.header}>
      <NavLink to="/" viewTransition className={styles.brand ?? ""}>
        <span className={styles.mark}>
          <Icon name="compass" size="lg" />
        </span>
        {t("common:app.name")}
      </NavLink>
      <nav className={styles.navigation} aria-label={t("explore:navigation.search")}>
        <NavLink to="/" end className={styles.link ?? ""}>
          <Icon name="search" size="sm" />
          {t("explore:navigation.search")}
        </NavLink>
        <NavLink to="/hotelier" className={styles.link ?? ""}>
          <Icon name="building" size="sm" />
          {t("explore:navigation.hotelier")}
        </NavLink>
      </nav>
      <div className={styles.controls}>
        <span className={styles.service} role="status">
          <Icon
            name={health.isSuccess ? "success" : health.isError ? "alert" : "loader"}
            size="sm"
          />
          {health.isSuccess
            ? t("explore:service.online")
            : health.isError
              ? t("explore:service.offline")
              : t("explore:service.loading")}
        </span>
        <LocaleSwitch />
        <ThemeSwitch />
      </div>
    </header>
  )
}
