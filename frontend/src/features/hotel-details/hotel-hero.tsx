import { HotelStars } from "@/entities/hotel"
import type { HotelSummary } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { sourceUrl } from "@/shared/api/source-url"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Icon, type IconName } from "@/shared/ui"
import { HotelCover } from "./hotel-cover"
import styles from "./hotel-hero.module.css"

type Supplier = components["schemas"]["SupplierDetails"]

export interface HotelHeroProps {
  readonly hotel: HotelSummary
  readonly supplier: Supplier | undefined
  readonly source?: string | null | undefined
  readonly titleId: string
  readonly onRooms: (() => void) | undefined
}

function coverPhotos(hotel: HotelSummary, supplier: Supplier | undefined): string[] {
  const urls = [
    hotel.thumbnail_url,
    ...(hotel.photos ?? []).map((photo) => photo.url),
    ...(supplier?.photos ?? []).map((photo) => photo.url),
  ]
  return [...new Set(urls.flatMap((url) => (sourceUrl(url) ? [sourceUrl(url) as string] : [])))]
}

function useHeroFacts(supplier: Supplier | undefined, source: string | null | undefined) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  if (!supplier) return []
  const score = supplier.rating?.total
  const rooms = supplier.facts.rooms_number
  const facts: { key: string; icon: IconName; text: string }[] = []
  if (score)
    facts.push({
      key: "rating",
      icon: "star",
      text: t(source ? "explore:hotelCover.sourceRating" : "explore:hotelCover.rating", {
        source: source ?? "",
        score: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(score),
        count: supplier.rating?.reviews_count ?? 0,
      }),
    })
  if (supplier.check_in_from)
    facts.push({
      key: "in",
      icon: "calendar",
      text: t("explore:hotelCover.checkIn", { time: supplier.check_in_from }),
    })
  if (supplier.check_out_until)
    facts.push({
      key: "out",
      icon: "calendar",
      text: t("explore:hotelCover.checkOut", { time: supplier.check_out_until }),
    })
  if (rooms)
    facts.push({
      key: "rooms",
      icon: "room",
      text: t("explore:hotelCover.rooms", { count: rooms }),
    })
  return facts
}

export function HotelHero({ hotel, supplier, source, titleId, onRooms }: HotelHeroProps) {
  const { t } = useTranslation()
  const facts = useHeroFacts(supplier, source)
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
      {facts.length ? (
        <ul className={styles.facts}>
          {facts.map((fact) => (
            <li key={fact.key} className={styles.fact}>
              <Icon name={fact.icon} size="sm" />
              {fact.text}
            </li>
          ))}
        </ul>
      ) : null}
      {onRooms ? (
        <div className={styles.actions}>
          <Button variant="secondary" icon="calendar" onClick={onRooms}>
            {t("explore:offers.viewRooms")}
          </Button>
        </div>
      ) : null}
    </header>
  )
}
