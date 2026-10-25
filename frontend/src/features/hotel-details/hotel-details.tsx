import { useState } from "react"
import { useHotel } from "@/entities/hotel"
import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import { characteristicTitle, matchedTitle } from "@/shared/geo/fact-label"
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
  const [factsOpen, setFactsOpen] = useState(false)
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
      {matched.length ? (
        <p className={styles.description}>
          {t("explore:details.summary", {
            matched: matched.filter((item) => item.match === "full" || item.match === "partial")
              .length,
            total: matched.length,
          })}
        </p>
      ) : null}
      {card.hotel.stars ? (
        <p className={styles.description}>
          {t("explore:details.summaryStars", { count: card.hotel.stars })}
        </p>
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
      <section className={styles.roomSection} aria-label={t("explore:details.rooms")}>
        <strong className={styles.roomHeading}>{t("explore:details.rooms")}</strong>
        {card.rooms?.length ? (
          card.rooms.map((room) => (
            <div key={room.id} className={styles.room}>
              <strong>{room.name}</strong>
              <span>{t("explore:details.roomCapacity", { count: room.capacity })}</span>
              <span>
                {t("explore:details.roomFloor", {
                  min: room.floor_range?.[0],
                  max: room.floor_range?.[1],
                })}
              </span>
              <span>
                {room.price_amount != null && room.price_currency
                  ? t("explore:details.roomPrice", {
                      amount: room.price_amount,
                      currency: room.price_currency,
                    })
                  : t("explore:details.roomPriceUnknown")}
              </span>
              <span>
                {room.facade_ids?.length
                  ? t("explore:details.roomSide", { value: room.facade_ids.join(", ") })
                  : t("explore:details.roomSideUnknown")}
              </span>
              <span>
                {room.included?.length
                  ? t("explore:details.roomIncluded", { value: room.included.join(", ") })
                  : t("explore:details.roomIncludedUnknown")}
              </span>
            </div>
          ))
        ) : (
          <p className={styles.help}>{t("explore:details.roomsUnknown")}</p>
        )}
      </section>
      {card.facts?.length ? (
        <section className={styles.factSection}>
          <Button
            variant="ghost"
            onClick={() => setFactsOpen((current) => !current)}
            aria-expanded={factsOpen}
          >
            {t("explore:details.allFacts")}
          </Button>
          {factsOpen ? (
            <div className={styles.rows}>
              {card.facts.map((item) => (
                <Button
                  key={item.fact_id}
                  variant="ghost"
                  className={styles.factRow}
                  onClick={() => onFact(item)}
                >
                  <strong>{characteristicTitle(item.characteristic_key, locale)}</strong>
                  <span>{item.explanation}</span>
                </Button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      {card.conflicts?.length ? (
        <p className={styles.notice}>{t("explore:details.conflicts")}</p>
      ) : null}
    </Card>
  )
}
