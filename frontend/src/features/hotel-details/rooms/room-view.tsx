import { useEffect, useRef } from "react"
import type { components } from "@/shared/api/schema.gen"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card } from "@/shared/ui"
import { OfferCard } from "../offer-card"
import { RoomGallery } from "./room-gallery"
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
  const title = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    title.current?.focus()
  }, [])
  const amenities = room.amenities.flatMap((code) => (AMENITIES[code] ? [AMENITIES[code]] : []))
  return (
    <Card className={styles.catalog} title={<span lang="ru">{room.name}</span>}>
      <Button ref={title} variant="ghost" icon="chevron-left" onClick={onBack}>
        {t("explore:rooms.back")}
      </Button>
      <RoomGallery photos={room.photos} name={room.name} />
      {room.size_sqm != null ? (
        <p>
          {t("explore:rooms.area", { value: new Intl.NumberFormat(locale).format(room.size_sqm) })}
        </p>
      ) : null}
      {room.bedding ? <p lang="ru">{room.bedding}</p> : null}
      {amenities.length ? (
        <ul className={styles.amenities}>
          {amenities.map((key) => (
            <li key={key}>{t(key)}</li>
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
        <p>{t("explore:rooms.noRate")}</p>
      )}
    </Card>
  )
}
