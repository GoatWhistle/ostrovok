import { useState } from "react"
import { useParams } from "react-router"
import { FactDetails } from "@/features/fact-details"
import { HotelDetails, HotelFacts } from "@/features/hotel-details"
import { HotelierAnswer, HotelierHeader } from "@/features/hotelier-answer"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { Dialog } from "@/shared/ui"
import styles from "./hotelier-page.module.css"

export function HotelierPage() {
  const { t } = useTranslation()
  const { hotelId } = useParams()
  const [selected, setSelected] = useState<{ hotel: string; fact: string }>()
  const [preview, setPreview] = useState(false)
  useDocumentTitle(t("explore:navigation.hotelier"))
  const openFact = (fact: string) => {
    if (hotelId) setSelected({ hotel: hotelId, fact })
  }
  return (
    <div className={styles.page}>
      <HotelierHeader hotelId={hotelId} onPreview={() => setPreview(true)} />
      <div className={styles.panels} data-detail={hotelId !== undefined}>
        <HotelierAnswer key={hotelId ?? "none"} hotelId={hotelId} onEditFact={openFact} />
        {hotelId ? (
          <aside className={styles.detail} aria-label={t("explore:hotelier.facts")}>
            {selected?.hotel === hotelId ? (
              <FactDetails
                hotelId={hotelId}
                factId={selected.fact}
                onBack={() => setSelected(undefined)}
                review
              />
            ) : (
              <HotelFacts
                hotelId={hotelId}
                title={t("explore:hotelier.facts")}
                onFact={(fact) => openFact(fact.fact_id)}
              />
            )}
          </aside>
        ) : null}
      </div>
      {preview && hotelId ? (
        <Dialog title={t("explore:hotelier.preview")} onClose={() => setPreview(false)}>
          <HotelDetails
            hotelId={hotelId}
            onFact={(fact) => {
              setPreview(false)
              openFact(fact.fact_id)
            }}
          />
        </Dialog>
      ) : null}
    </div>
  )
}
