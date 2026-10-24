import { useSearchParams } from "react-router"
import { HotelComparison } from "@/features/hotel-comparison"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { ButtonLink, PageHeader } from "@/shared/ui"
import styles from "./compare-page.module.css"
export function ComparePage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  useDocumentTitle(t("explore:compare.title"))
  return (
    <div className={styles.page}>
      <PageHeader
        title={t("explore:compare.title")}
        description={t("explore:compare.description")}
        actions={
          <ButtonLink to="/" variant="secondary" icon="back">
            {t("explore:compare.back")}
          </ButtonLink>
        }
      />
      <HotelComparison ids={[...new Set(params.getAll("hotel"))]} />
    </div>
  )
}
