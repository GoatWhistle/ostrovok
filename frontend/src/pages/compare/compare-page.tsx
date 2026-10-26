import { useState } from "react"
import { useSearchParams } from "react-router"
import { FactDetails } from "@/features/fact-details"
import { HotelComparison } from "@/features/hotel-comparison"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { ButtonLink, Dialog, PageHeader } from "@/shared/ui"
import styles from "./compare-page.module.css"
export function ComparePage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [fact, setFact] = useState<{ hotelId: string; factId: string }>()
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
      <HotelComparison
        key={params.toString()}
        ids={[...new Set(params.getAll("hotel"))]}
        onFact={(hotelId, factId) => setFact({ hotelId, factId })}
        onRemove={(id) => {
          const next = new URLSearchParams(params)
          next.delete("hotel", id)
          setParams(next)
        }}
      />
      {fact ? (
        <Dialog title={t("explore:details.provenance")} onClose={() => setFact(undefined)}>
          <FactDetails
            hotelId={fact.hotelId}
            factId={fact.factId}
            onBack={() => setFact(undefined)}
          />
        </Dialog>
      ) : null}
    </div>
  )
}
