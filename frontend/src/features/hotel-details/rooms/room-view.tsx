import { useEffect, useRef } from "react"
import type { components } from "@/shared/api/schema.gen"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import { Button, Icon } from "@/shared/ui"
import { HotelCover } from "../hotel-cover"
import { OfferCard } from "../offer-card"
import styles from "./rooms.module.css"

type Room = components["schemas"]["SupplierRoom"]
type Offer = components["schemas"]["RoomOffer"]
const AMENITIES: Readonly<Record<string, MessageKey>> = {
  "air-conditioning": "explore:rooms.amenities.airConditioning",
  "private-bathroom": "explore:rooms.amenities.bathroom",
  shower: "explore:rooms.amenities.shower",
  toiletries: "explore:rooms.amenities.toiletries",
  balcony: "explore:rooms.amenities.balcony",
  "non-smoking": "explore:offers.nonSmoking",
  safe: "explore:rooms.amenities.safe",
  tv: "explore:rooms.amenities.tv",
  "mini-bar": "explore:rooms.amenities.minibar",
  minibar: "explore:rooms.amenities.minibar",
  bathrobe: "explore:rooms.amenities.bathrobe",
  slippers: "explore:rooms.amenities.slippers",
  hairdryer: "explore:rooms.amenities.hairdryer",
  "blackout-blinds": "explore:rooms.amenities.blackout",
  bedsheets: "explore:rooms.amenities.bedsheets",
  desk: "explore:rooms.amenities.desk",
  mirror: "explore:rooms.amenities.mirror",
  tea: "explore:rooms.amenities.tea",
  telephone: "explore:rooms.amenities.telephone",
  towels: "explore:rooms.amenities.towels",
  wardrobe: "explore:rooms.amenities.wardrobe",
  water: "explore:rooms.amenities.water",
  "addon-service": "explore:rooms.amenities.extras",
  bath: "explore:rooms.amenities.bath",
  "high-speed-internet-access": "explore:rooms.amenities.internet",
  hypoallergenic: "explore:rooms.amenities.hypoallergenic",
  patio: "explore:rooms.amenities.patio",
  pillows: "explore:rooms.amenities.pillows",
  "with-view": "explore:rooms.amenities.view",
  heating: "explore:rooms.amenities.heating",
}

export function RoomView({
  room,
  offers,
  onBack,
}: {
  readonly room: Room
  readonly offers: readonly Offer[]
  readonly onBack: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    back.current?.focus({ preventScroll: true })
  }, [])
  const amenities = room.amenities.flatMap((code) => (AMENITIES[code] ? [AMENITIES[code]] : []))
  const facts = [
    room.size_sqm != null
      ? t("explore:roomsScreen.area", {
          value: new Intl.NumberFormat(locale).format(room.size_sqm),
        })
      : undefined,
    room.bedding ?? undefined,
  ].filter((value): value is string => Boolean(value))
  return (
    <section className={styles.room} aria-label={room.name}>
      <Button ref={back} variant="ghost" size="compact" icon="chevron-left" onClick={onBack}>
        {t("explore:rooms.back")}
      </Button>
      <HotelCover key={room.id} photos={room.photos} name={room.name} />
      <p className={styles.roomName} lang="ru">
        {room.name}
      </p>
      {facts.length ? (
        <ul className={styles.tags}>
          {facts.map((fact) => (
            <li key={fact} className={styles.tag} lang="ru">
              {fact}
            </li>
          ))}
        </ul>
      ) : null}
      {amenities.length ? (
        <ul className={styles.amenityGrid}>
          {amenities.map((key) => (
            <li key={key} className={styles.amenity}>
              <Icon name="check" size="sm" />
              {t(key)}
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.title}>{t("explore:rooms.rates")}</p>
      {offers.length ? (
        <ul className={styles.list}>
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </ul>
      ) : (
        <p className={styles.rowDetails}>{t("explore:roomsScreen.noRate")}</p>
      )}
    </section>
  )
}
