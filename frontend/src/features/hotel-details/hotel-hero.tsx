import { HotelRating, HotelStars } from "@/entities/hotel"
import type { HotelSummary } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { sourceUrl } from "@/shared/api/source-url"
import { useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import { HotelCover } from "./hotel-cover"
import styles from "./hotel-hero.module.css"

type Supplier = components["schemas"]["SupplierDetails"]

export interface HotelHeroProps {
  readonly hotel: HotelSummary
  readonly supplier: Supplier | undefined
  readonly titleId: string
}

function coverPhotos(hotel: HotelSummary, supplier: Supplier | undefined): string[] {
  const urls = [
    hotel.thumbnail_url,
    ...(hotel.photos ?? []).map((photo) => photo.url),
    ...(supplier?.photos ?? []).map((photo) => photo.url),
  ]
  return [...new Set(urls.flatMap((url) => (sourceUrl(url) ? [sourceUrl(url) as string] : [])))]
}

function useHeroFacts(supplier: Supplier | undefined) {
  const { t } = useTranslation()
  if (!supplier) return []
  const rooms = supplier.facts.rooms_number
  return [
    supplier.check_in_from
      ? t("explore:hotelCover.checkIn", { time: supplier.check_in_from })
      : undefined,
    supplier.check_out_until
      ? t("explore:hotelCover.checkOut", { time: supplier.check_out_until })
      : undefined,
    rooms ? t("explore:hotelCover.rooms", { count: rooms }) : undefined,
  ].filter((text): text is string => Boolean(text))
}

export function HotelHero({ hotel, supplier, titleId }: HotelHeroProps) {
  const facts = useHeroFacts(supplier)
  const score = supplier?.rating?.total ?? undefined
  return (
    <header className={styles.hero}>
      <HotelCover key={hotel.id} photos={coverPhotos(hotel, supplier)} name={hotel.name} />
      <div className={styles.title}>
        <div className={styles.naming}>
          <p id={titleId} className={styles.name} lang="ru">
            {hotel.name}
          </p>
          <HotelStars value={hotel.stars ?? supplier?.facts.star_rating} />
        </div>
        {hotel.address ? (
          <p className={styles.address}>
            <Icon name="pin" size="sm" className={styles.pin} />
            <span lang="ru">{hotel.address}</span>
          </p>
        ) : null}
      </div>
      {score || facts.length ? (
        <div className={styles.facts}>
          <HotelRating score={score} reviews={supplier?.rating?.reviews_count ?? 0} />
          {facts.map((text) => (
            <span key={text} className={styles.fact}>
              {text}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  )
}
