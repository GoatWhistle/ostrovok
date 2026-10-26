import { useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card } from "@/shared/ui"
import { OfferCard } from "../offer-card"
import { RoomView } from "./room-view"
import styles from "./rooms.module.css"

type Offers = components["schemas"]["HotelOffers"]

export function RoomCatalog({ content }: { readonly content: Offers }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [selected, setSelected] = useState<string>()
  const rooms = content.room_groups ?? []
  const offers = content.offers ?? []
  const room = rooms.find((item) => item.id === selected)
  if (room)
    return (
      <RoomView
        key={room.id}
        room={room}
        offers={offers.filter((item) => item.room_group_id === room.id)}
        onBack={() => setSelected(undefined)}
      />
    )
  const ungrouped = offers.filter((offer) => !rooms.some((item) => item.id === offer.room_group_id))
  return (
    <div className={styles.catalog}>
      <p className={styles.title}>{t("explore:offers.categoriesTitle")}</p>
      <p>{t("explore:offers.categoriesNote")}</p>
      <p>{t("explore:rooms.count", { rooms: rooms.length, rates: offers.length })}</p>
      <ul className={styles.list}>
        {rooms.map((item) => {
          const rates = offers.filter((offer) => offer.room_group_id === item.id)
          const first = rates[0]
          const price = first
            ? new Intl.NumberFormat(locale, {
                style: "currency",
                currency: first.price_currency,
                maximumFractionDigits: 0,
              }).format(first.price_amount)
            : undefined
          return (
            <li key={item.id}>
              <Card className={styles.card} title={<span lang="ru">{item.name}</span>}>
                {item.photos[0] ? (
                  <img
                    className={styles.thumbnail}
                    src={item.photos[0]}
                    alt={item.name}
                    loading="lazy"
                  />
                ) : null}

                {item.bedding ? <p lang="ru">{item.bedding}</p> : null}
                <p>
                  {price ? t("explore:offers.fromPrice", { price }) : t("explore:rooms.noRate")}
                </p>
                {price ? <p>{t("explore:offers.stayTotal")}</p> : null}
                <Button variant="secondary" onClick={() => setSelected(item.id)}>
                  {t("explore:rooms.open")}
                </Button>
              </Card>
            </li>
          )
        })}
        {ungrouped.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </ul>
    </div>
  )
}
