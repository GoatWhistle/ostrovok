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
  readonly source?: string | null | undefined
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
  const { rooms_number: rooms, floors_number: floors, year_built: built } = supplier.facts
  const renovated = supplier.facts.year_renovated
  return [
    supplier.check_in_from
      ? t("explore:hotelCover.checkIn", { time: supplier.check_in_from })
      : undefined,
    supplier.check_out_until
      ? t("explore:hotelCover.checkOut", { time: supplier.check_out_until })
      : undefined,
    rooms ? t("explore:hotelCover.rooms", { count: rooms }) : undefined,
    floors ? t("explore:hotelCover.floors", { count: floors }) : undefined,
    built ? t("explore:hotelCover.built", { year: built }) : undefined,
    renovated ? t("explore:hotelCover.renovated", { year: renovated }) : undefined,
  ].filter((text): text is string => Boolean(text))
}

function SupplierLink({ url, source }: { readonly url: string; readonly source: string }) {
  const { t } = useTranslation()
  const label = t("explore:supplier.open", { source })
  return (
    <a
      className={styles.external}
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      title={label}
    >
      <Icon name="external" size="sm" />
    </a>
  )
}

export function HotelHero({ hotel, supplier, source, titleId }: HotelHeroProps) {
  const facts = useHeroFacts(supplier)
  const score = supplier?.rating?.total ?? undefined
  const pageUrl = supplier ? sourceUrl(supplier.page_url) : undefined
  return (
    <header className={styles.hero}>
      <HotelCover key={hotel.id} photos={coverPhotos(hotel, supplier)} name={hotel.name} />
      <div className={styles.title}>
        <div className={styles.naming}>
          <p id={titleId} className={styles.name} lang="ru">
            {hotel.name}
          </p>
          <span className={styles.badges}>
            <HotelStars value={hotel.stars ?? supplier?.facts.star_rating} />
            {pageUrl ? <SupplierLink url={pageUrl} source={source ?? ""} /> : null}
          </span>
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
          <HotelRating score={score} reviews={supplier?.rating?.reviews_count ?? 0} size="body" />
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
