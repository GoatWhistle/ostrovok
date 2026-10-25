import { useId } from "react"
import { useNavigate } from "react-router"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { BrandMark, Button, ButtonLink, LostRoute, StatusBadge } from "@/shared/ui"
import styles from "./not-found-page.module.css"

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const titleId = useId()
  useDocumentTitle(t("common:notFound.title"))
  return (
    <section className={styles.page} aria-labelledby={titleId}>
      <LostRoute />
      <div className={styles.copy}>
        <div className={styles.head}>
          <BrandMark size="md" motion="enter" />
          <StatusBadge tone="neutral" icon="unknown" className={styles.code}>
            {t("common:notFound.code")}
          </StatusBadge>
        </div>
        <h1 id={titleId} className={styles.title} tabIndex={-1}>
          {t("common:notFound.title")}
        </h1>
        <p className={styles.description}>{t("common:notFound.description")}</p>
        <div className={styles.actions}>
          <ButtonLink to="/" icon="search">
            {t("common:notFound.search")}
          </ButtonLink>
          <Button variant="ghost" icon="back" onClick={() => void navigate(-1)}>
            {t("common:notFound.back")}
          </Button>
        </div>
      </div>
    </section>
  )
}
