import { useHotel } from "@/entities/hotel"
import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import { matchedTitle } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card, EmptyState, ErrorState, Icon, Skeleton } from "@/shared/ui"
import { characteristicIcon } from "@/shared/ui/primitives/icon/characteristic-icon"
import styles from "./hotel-details.module.css"

export interface HotelDetailsProps {
  readonly hotelId: string | undefined
  readonly matched?: readonly MatchedProperty[]
  readonly onProperty?: (property: MatchedProperty) => void
  readonly onFact: (fact: FactBrief) => void
  readonly onPreview?: (property: MatchedProperty | undefined) => void
}

export function HotelDetails({
  hotelId,
  matched = [],
  onProperty,
  onFact,
  onPreview,
}: HotelDetailsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const hotel = useHotel(hotelId)
  if (!hotelId)
    return (
      <EmptyState
        icon="building"
        title={t("explore:details.empty")}
        description={t("explore:details.emptyText")}
      />
    )
  if (hotel.isPending) return <Skeleton />
  if (hotel.isError)
    return <ErrorState title={t("explore:details.error")} onRetry={() => void hotel.refetch()} />
  const card = hotel.data
  return (
    <Card
      as="article"
      title={card.hotel.name}
      eyebrow={t("explore:details.hotel")}
      description={card.hotel.address ?? undefined}
      className={styles.product}
    >
      {card.hotel.stars ? (
        <div className={styles.summary}>
          <span>{t("explore:details.stars", { count: card.hotel.stars })}</span>
        </div>
      ) : null}
      {matched.length ? (
        <Card title={t("explore:details.yourRequest")} className={styles.section}>
          <p className={styles.help}>{t("explore:details.mapHint")}</p>
          <div className={styles.rows}>
            {matched.map((item) => {
              const fact = item.fact
              const hasMap = (item.geo_refs?.length ?? fact?.geo_refs?.length ?? 0) > 0
              const title = matchedTitle(item, locale)
              const content = (
                <span key={item.characteristic_key} className={styles.rowContent}>
                  <strong>{title}</strong>
                  <span className={styles.rowMeta}>
                    {fact
                      ? hasMap
                        ? t("explore:details.showOnMap")
                        : t(`explore:match.${item.match}`)
                      : t("explore:details.noEvidence")}
                  </span>
                </span>
              )
              return fact ? (
                <Button
                  key={item.characteristic_key}
                  variant="ghost"
                  icon={characteristicIcon(item.characteristic_key)}
                  onClick={() => {
                    if (hasMap && onProperty) onProperty(item)
                    else onFact(fact)
                  }}
                  onPointerEnter={() => onPreview?.(item)}
                  onPointerLeave={() => onPreview?.(undefined)}
                  onFocus={() => onPreview?.(item)}
                  onBlur={() => onPreview?.(undefined)}
                  className={styles.row}
                >
                  {content}
                </Button>
              ) : (
                <div key={item.characteristic_key} className={styles.unavailable}>
                  <Icon name={characteristicIcon(item.characteristic_key)} size="sm" />
                  {content}
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}
      {card.conflicts?.length ? (
        <p className={styles.notice}>{t("explore:details.conflicts")}</p>
      ) : null}
    </Card>
  )
}
