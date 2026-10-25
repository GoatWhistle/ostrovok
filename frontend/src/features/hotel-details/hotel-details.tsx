import { clsx } from "clsx"
import { useId } from "react"
import { useHotel } from "@/entities/hotel"
import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Banner, Disclosure, EmptyState, ErrorState, Skeleton } from "@/shared/ui"
import { FactList } from "./fact-list"
import styles from "./hotel-details.module.css"
import { HotelFacilities } from "./hotel-facilities"
import { HotelHero } from "./hotel-hero"
import { HotelOffers } from "./hotel-offers"
import { MatchRows } from "./match-rows"
import { RoomList } from "./room-list"

export interface HotelDetailsProps {
  readonly hotelId: string | undefined
  readonly matched?: readonly MatchedProperty[]
  readonly stay?: components["schemas"]["SearchResponse"]["parsed"] | undefined
  readonly onProperty?: (property: MatchedProperty) => void
  readonly onFact: (fact: FactBrief) => void
  readonly onPreview?: (property: MatchedProperty | undefined) => void
  readonly className?: string | undefined
}

function DetailsSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <Skeleton shape="block" className={styles.skeletonThumb} />
      <Skeleton lines={3} />
      <Skeleton lines={4} className={styles.skeletonWide} />
    </div>
  )
}

export function HotelDetails({
  hotelId,
  matched = [],
  stay,
  onProperty,
  onFact,
  onPreview,
  className,
}: HotelDetailsProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const hotel = useHotel(hotelId)
  if (!hotelId)
    return (
      <EmptyState
        icon="building"
        title={t("explore:details.empty")}
        description={t("explore:details.emptyText")}
        className={className}
      />
    )
  if (hotel.isPending) return <DetailsSkeleton />
  if (hotel.isError)
    return (
      <ErrorState
        title={t("explore:details.error")}
        onRetry={() => void hotel.refetch()}
        retryPending={hotel.isFetching}
        className={className}
      />
    )
  const card = hotel.data
  const rooms = card.rooms ?? []
  return (
    <article
      className={clsx(styles.details, className)}
      aria-labelledby={titleId}
      data-motion="fade"
    >
      <HotelHero hotel={card.hotel} matched={matched} titleId={titleId} />
      {card.conflicts?.length ? (
        <Banner tone="warning" icon="alert" title={t("explore:details.conflicts")}>
          {t("explore:details.conflictsText")}
        </Banner>
      ) : null}
      {card.stale_count ? (
        <Banner
          tone="neutral"
          icon="stale"
          title={t("explore:details.staleCount", { count: card.stale_count })}
        >
          {t("explore:details.staleText")}
        </Banner>
      ) : null}
      {matched.length ? (
        <MatchRows
          matched={matched}
          onProperty={onProperty}
          onFact={onFact}
          onPreview={onPreview}
        />
      ) : null}
      <Disclosure title={t("explore:details.rooms")} icon="room" defaultOpen>
        {rooms.length ? <RoomList rooms={rooms} /> : <p>{t("explore:details.roomsUnavailable")}</p>}
      </Disclosure>
      <HotelFacilities
        facilitiesRu={card.facilities_ru ?? []}
        facilitiesEn={card.facilities_en ?? []}
      />
      <HotelOffers hotelId={card.hotel.id} stay={stay} />
      <FactList facts={card.facts} onFact={onFact} />
    </article>
  )
}
