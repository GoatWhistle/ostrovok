import { useHotel } from "@/entities/hotel"
import { useTranslation } from "@/shared/i18n"
import { Button, Disclosure, Icon, PageHeader, Skeleton } from "@/shared/ui"
import styles from "./hotelier-header.module.css"
import { LookupForm } from "./lookup-form"

export interface HotelierHeaderProps {
  readonly hotelId: string | undefined
  readonly onPreview: () => void
}

export function HotelierHeader({ hotelId, onPreview }: HotelierHeaderProps) {
  const { t } = useTranslation()
  const hotel = useHotel(hotelId)
  const summary = hotel.data?.hotel
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
      <div className={styles.identity}>
        {summary?.thumbnail_url ? (
          <img className={styles.photo} src={summary.thumbnail_url} alt="" />
        ) : null}
        <div className={styles.title}>
          {summary?.stars ? (
            <p className={styles.stars}>
              <Icon name="star" size="sm" />
              {t("explore:workspace.stars", { count: summary.stars })}
            </p>
          ) : null}
          {hotel.isPending ? (
            <Skeleton lines={2} />
          ) : (
            <PageHeader title={summary?.name ?? hotelId} />
          )}
          <p className={styles.description}>{t("explore:workspace.headerText")}</p>
        </div>
        <Button variant="ghost" icon="guests" onClick={onPreview}>
          {t("explore:hotelier.preview")}
        </Button>
      </div>
      <div className={styles.change}>
        <Disclosure title={t("explore:hotelier.change")} icon="building">
          <LookupForm hotelId={hotelId} />
        </Disclosure>
      </div>
    </div>
  )
}
