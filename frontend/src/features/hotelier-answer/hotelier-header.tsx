import { useHotel } from "@/entities/hotel"
import { useTranslation } from "@/shared/i18n"
import { Button, Disclosure, PageHeader } from "@/shared/ui"
import styles from "./hotelier-header.module.css"
import { LookupForm } from "./lookup-form"

export interface HotelierHeaderProps {
  readonly hotelId: string | undefined
  readonly onPreview: () => void
}

export function HotelierHeader({ hotelId, onPreview }: HotelierHeaderProps) {
  const { t } = useTranslation()
  const hotel = useHotel(hotelId)
  if (!hotelId)
    return (
      <div className={styles.header}>
        <PageHeader
          title={t("explore:hotelier.badge")}
          description={t("explore:hotelier.description")}
        />
        <LookupForm hotelId={undefined} />
      </div>
    )
  return (
    <div className={styles.header}>
      <PageHeader
        title={hotel.data?.hotel.name ?? hotelId}
        description={t("explore:hotelier.badge")}
        actions={
          <Button variant="secondary" icon="guests" onClick={onPreview}>
            {t("explore:hotelier.preview")}
          </Button>
        }
      />
      <div className={styles.change}>
        <Disclosure title={t("explore:hotelier.change")} icon="building">
          <LookupForm hotelId={hotelId} />
        </Disclosure>
      </div>
    </div>
  )
}
