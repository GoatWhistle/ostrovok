import { HotelRating, HotelStars } from "@/entities/hotel"
import type { HotelSummary } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { sourceUrl } from "@/shared/api/source-url"
import { useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import { HotelCover } from "../hotel-cover/hotel-cover"
import { useHeroFacts } from "../panels/hotel-stay-details"
import styles from "./hotel-hero.module.css"

type Supplier = components["schemas"]["SupplierDetails"]

export interface HotelHeroProps {
  readonly hotel: HotelSummary
  readonly supplier: Supplier | undefined
  readonly source?: string | null | undefined
  readonly compact?: boolean
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

export function HotelHero({ hotel, supplier, source, titleId, compact = false }: HotelHeroProps) {
  const details = useHeroFacts(supplier)
  const facts = compact ? [] : details
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
