import { useEffect } from "react"
import { useRouteError } from "react-router"
import { useTranslation } from "@/shared/i18n"
import { BrandMark, ErrorState } from "@/shared/ui"
import styles from "./root-error.module.css"

export function RootError() {
  const { t } = useTranslation()
  const error = useRouteError()
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className={styles.page}>
      <p className={styles.brand}>
        <BrandMark size="md" />
        <span>{t("common:app.wordmark")}</span>
      </p>
      <ErrorState
        title={t("errors:boundary.title")}
        description={t("errors:boundary.description")}
        onRetry={() => window.location.reload()}
        className={styles.state}
      />
    </main>
  )
}
