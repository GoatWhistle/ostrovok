import type { HotelSummary, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { useInViewport } from "@/shared/hooks"
import { staggerStyle } from "@/shared/motion"
import { Button, Icon } from "@/shared/ui"
import { HotelStars } from "../hotel-stars/hotel-stars"
import { HotelThumb } from "../hotel-thumb/hotel-thumb"
import { MatchScore, matchScore } from "../match-score/match-score"
import { OfferPreview } from "../offer-preview/offer-preview"
import { HotelMatches } from "./hotel-matches"
import styles from "./hotel-result.module.css"

export interface HotelResultProps {
  readonly result: SearchResult
  readonly selected: boolean
  readonly index?: number
  readonly onSelect: () => void
  readonly onProperty: (property: MatchedProperty) => void
  readonly onPreview: (property: MatchedProperty | undefined) => void
}

export function HotelResult({ result, ...props }: HotelResultProps) {
  return <HotelSummaryCard hotel={result.hotel} matched={result.matched} {...props} />
}

interface HotelSummaryCardProps extends Omit<HotelResultProps, "result"> {
  readonly hotel: HotelSummary
  readonly matched: readonly MatchedProperty[]
  readonly onRooms?: () => void
  readonly idPrefix?: string
}

export function HotelSummaryCard({
  hotel,
  matched,
  selected,
  index,
  onSelect,
  onProperty,
  onPreview,
  onRooms = onSelect,
  idPrefix = "hotel-result",
}: HotelSummaryCardProps) {
  const viewport = useInViewport()
  return (
    <article
      ref={viewport.ref}
      className={styles.hotel}
      data-selected={selected}
      style={index === undefined ? undefined : staggerStyle(index)}
    >
      <HotelThumb src={hotel.thumbnail_url} photos={hotel.photos} />
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
          <MatchScore score={matchScore({ matched })} className={styles.score} />
        </div>
        <HotelStars value={hotel.stars} />
        {hotel.address ? (
          <p className={styles.meta}>
            <Icon name="pin" size="sm" />
            <span>{hotel.address}</span>
          </p>
        ) : null}
        <HotelMatches matched={matched} onProperty={onProperty} onPreview={onPreview} />
        <OfferPreview hotelId={hotel.id} onSelect={onRooms} enabled={viewport.visible} />
      </div>
    </article>
  )
}
