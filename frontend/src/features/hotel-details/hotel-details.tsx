import { useHotel } from "@/entities/hotel"
import type { FactBrief } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Button, ButtonLink, Card, EmptyState, ErrorState, Skeleton } from "@/shared/ui"
import { characteristicIcon } from "@/shared/ui/primitives/icon/characteristic-icon"
import styles from "./hotel-details.module.css"
export interface HotelDetailsProps {
  readonly hotelId: string | undefined
  readonly onFact: (fact: FactBrief) => void
}
export function HotelDetails({ hotelId, onFact }: HotelDetailsProps) {
  const { t } = useTranslation()
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
    <div className={styles.details}>
      <Card title={card.hotel.name} description={card.hotel.address ?? undefined}>
        {card.hotel.levels !== null && card.hotel.levels !== undefined ? (
          <p>{t("explore:details.levels", { count: card.hotel.levels })}</p>
        ) : null}
        {card.conflicts?.length ? (
          <p className={styles.notice}>{t("explore:details.conflicts")}</p>
        ) : null}
        <div className={styles.facts}>
          {card.facts.map((fact) => (
            <Button
              key={fact.fact_id}
              variant="ghost"
              icon={characteristicIcon(fact.characteristic_key)}
              onClick={() => onFact(fact)}
              className={styles.fact}
            >
              <span className={styles.factText}>
                <span>{fact.label}</span>
                <span className={styles.meta}>{t(`explore:status.${fact.status}`)}</span>
              </span>
            </Button>
          ))}
        </div>
        <ButtonLink to={`/hotelier/${encodeURIComponent(hotelId)}`} icon="send" variant="secondary">
          {t("explore:details.ask")}
        </ButtonLink>
      </Card>
      {card.rooms?.length ? (
        <Card title={t("explore:details.rooms")}>
          <div className={styles.rooms}>
            {card.rooms.map((room) => (
              <div key={room.id ?? room.name} className={styles.room}>
                <p className={styles.roomName}>{room.name}</p>
                {room.facts?.map((fact) => (
                  <Button
                    key={fact.fact_id}
                    variant="ghost"
                    icon={characteristicIcon(fact.characteristic_key)}
                    onClick={() => onFact(fact)}
                  >
                    {fact.label}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
