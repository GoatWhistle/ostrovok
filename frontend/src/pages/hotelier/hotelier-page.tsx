import { useState } from "react"
import { useParams } from "react-router"
import { FactDetails } from "@/features/fact-details"
import { HotelDetails } from "@/features/hotel-details"
import { HotelierHeader } from "@/features/hotelier-answer"
import { HotelierWorkspace } from "@/features/hotelier-workspace"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { Dialog } from "@/shared/ui"
import styles from "./hotelier-page.module.css"

export function HotelierPage() {
  const { t } = useTranslation()
  const { hotelId } = useParams()
  const [preview, setPreview] = useState(false)
  const [factId, setFactId] = useState<string>()
  useDocumentTitle(t("explore:navigation.hotelier"))
  return (
    <div className={styles.page}>
      <HotelierHeader hotelId={hotelId} onPreview={() => setPreview(true)} />
      {hotelId ? <HotelierWorkspace key={hotelId} hotelId={hotelId} /> : null}
      {preview && hotelId ? (
        <Dialog
          title={t("explore:hotelier.preview")}
          onClose={() => {
            setPreview(false)
            setFactId(undefined)
          }}
        >
          {factId ? (
            <FactDetails hotelId={hotelId} factId={factId} onBack={() => setFactId(undefined)} />
          ) : (
            <HotelDetails hotelId={hotelId} onFact={(fact) => setFactId(fact.fact_id)} />
          )}
        </Dialog>
      ) : null}
    </div>
  )
}
