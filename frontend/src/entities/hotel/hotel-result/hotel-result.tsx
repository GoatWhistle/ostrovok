import type { MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { useInViewport } from "@/shared/hooks"
import { staggerStyle } from "@/shared/motion"
import { Button, Icon } from "@/shared/ui"
import { HotelStars } from "../hotel-stars/hotel-stars"
import { HotelThumb } from "../hotel-thumb/hotel-thumb"
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

export function HotelResult({
  result,
  selected,
  index,
  onSelect,
  onProperty,
  onPreview,
}: HotelResultProps) {
  const viewport = useInViewport()
  return (
    <article
      ref={viewport.ref}
      className={styles.hotel}
      data-selected={selected}
      style={index === undefined ? undefined : staggerStyle(index)}
    >
      <HotelThumb src={result.hotel.thumbnail_url} photos={result.hotel.photos} />
      <div className={styles.body}>
        <div className={styles.top}>
          <Button
            variant="ghost"
            align="start"
            className={styles.name}
            id={`hotel-result-${result.hotel.id}`}
            aria-pressed={selected}
            onClick={onSelect}
          >
            {result.hotel.name}
          </Button>
        </div>
        <HotelStars value={result.hotel.stars} />
        {result.hotel.address ? (
          <p className={styles.meta}>
            <Icon name="pin" size="sm" />
            <span>{result.hotel.address}</span>
          </p>
        ) : null}
        <HotelMatches matched={result.matched} onProperty={onProperty} onPreview={onPreview} />
        <OfferPreview hotelId={result.hotel.id} onSelect={onSelect} enabled={viewport.visible} />
      </div>
    </article>
  )
}
