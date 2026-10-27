import { useState } from "react"
import { useParams } from "react-router"
import { FactDetails } from "@/features/fact-details"
import { HotelDetails } from "@/features/hotel-details"
import { HotelierAnswer } from "@/features/hotelier-answer"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { PageHeader, StatusBadge } from "@/shared/ui"
import styles from "./hotelier-page.module.css"

export function HotelierPage() {
  const { t } = useTranslation()
  const { hotelId } = useParams()
  const [selected, setSelected] = useState<{ hotel: string; fact: string }>()
  useDocumentTitle(t("explore:navigation.hotelier"))
  return (
    <div className={styles.page}>
      <PageHeader
        title={t("explore:hotelier.title")}
        description={t("explore:hotelier.description")}
        actions={
          <StatusBadge tone="info" icon="hotelier">
            {t("explore:hotelier.badge")}
          </StatusBadge>
        }
      />
      <div className={styles.panels} data-detail={hotelId !== undefined}>
        <HotelierAnswer
          key={hotelId ?? "none"}
          hotelId={hotelId}
          onEditFact={(fact) => {
            if (hotelId) setSelected({ hotel: hotelId, fact })
          }}
        />
        {hotelId ? (
          <aside className={styles.detail} aria-label={t("explore:hotelier.hotelCard")}>
            {selected?.hotel === hotelId ? (
              <FactDetails
                hotelId={hotelId}
                factId={selected.fact}
                onBack={() => setSelected(undefined)}
                review
              />
            ) : (
              <HotelDetails
                hotelId={hotelId}
                onFact={(fact) => setSelected({ hotel: hotelId, fact: fact.fact_id })}
              />
            )}
          </aside>
        ) : null}
      </div>
    </div>
  )
}
