import { Outlet, ScrollRestoration } from "react-router"
import { useTranslation } from "@/shared/i18n"
import { KeyboardInputContext, useInputModality } from "@/shared/motion"
import { AppHeader } from "../app-header/app-header"
import styles from "./root-layout.module.css"
import { useRouteFocus } from "./use-route-focus"

export function RootLayout() {
  const { t } = useTranslation()
  const modality = useInputModality(true)
  useRouteFocus()
  return (
    <KeyboardInputContext value={modality.instant}>
      <div className={styles.shell} data-input-source={modality.instant ? "keyboard" : "pointer"}>
        <a className={styles.skip} href="#main">
          {t("common:shell.skip")}
        </a>
        <AppHeader />
        <main id="main" tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
        <ScrollRestoration />
      </div>
    </KeyboardInputContext>
  )
}
