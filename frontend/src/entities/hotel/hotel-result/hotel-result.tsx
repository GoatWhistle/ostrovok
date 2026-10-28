import type { HotelSummary, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { useInViewport } from "@/shared/hooks"
import { staggerStyle } from "@/shared/motion"
import { Button } from "@/shared/ui"
import { HotelRating } from "../hotel-rating/hotel-rating"
import { HotelStars } from "../hotel-stars/hotel-stars"
import { HotelThumb } from "../hotel-thumb/hotel-thumb"
import { MatchExplain } from "../match-score/match-explain"
import { OfferPreview } from "../offer-preview/offer-preview"
import styles from "./hotel-result.module.css"
import { useHotelPreview } from "./use-hotel-preview"

export interface HotelResultProps {
  readonly result: SearchResult
  readonly selected: boolean
  readonly index?: number
  readonly onSelect: () => void
  readonly onProperty: (property: MatchedProperty) => void
  readonly onPreview: (property: MatchedProperty | undefined) => void
}

export function HotelResult({ result, ...props }: HotelResultProps) {
  return (
    <HotelSummaryCard
      hotel={result.hotel}
      matched={result.matched}
      confidence={result.confidence}
      {...props}
    />
  )
}

interface HotelSummaryCardProps extends Omit<HotelResultProps, "result"> {
  readonly hotel: HotelSummary
  readonly matched: readonly MatchedProperty[]
  readonly confidence?: number | undefined
  readonly onRooms?: () => void
  readonly idPrefix?: string
}

export function HotelSummaryCard({
  hotel,
  matched,
  confidence,
  selected,
  index,
  onSelect,
  onRooms = onSelect,
  idPrefix = "hotel-result",
}: HotelSummaryCardProps) {
  const viewport = useInViewport()
  const preview = useHotelPreview(hotel.id, viewport.visible)
  return (
    <article
      ref={viewport.ref}
      className={styles.hotel}
      data-selected={selected}
      style={index === undefined ? undefined : staggerStyle(index)}
    >
      <HotelThumb
        src={hotel.thumbnail_url}
        photos={hotel.photos}
        extra={preview.photos}
        placeholder
        className={styles.thumb}
      />
      <div className={styles.body}>
        <div className={styles.top}>
          <Button
            variant="ghost"
            align="start"
            className={styles.name}
            id={`${idPrefix}-${hotel.id}`}
            aria-pressed={selected}
            onClick={onSelect}
          >
            {hotel.name}
          </Button>
          <MatchExplain matched={matched} confidence={confidence} />
        </div>
        <div className={styles.meta}>
          <HotelStars value={hotel.stars ?? preview.stars} />
          <HotelRating score={preview.rating} reviews={preview.reviews} />
        </div>
        {hotel.address ? <p className={styles.address}>{hotel.address}</p> : null}
        <div className={styles.price}>
          <OfferPreview hotelId={hotel.id} onSelect={onRooms} enabled={viewport.visible} />
        </div>
      </div>
    </article>
  )
}
