import { useEffect, useRef } from "react"
import { HotelThumb, minimumOffers, useHotelRoom } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card } from "@/shared/ui"
import { OfferCard } from "../offer-card"
import { RoomView } from "./room-view"
import styles from "./rooms.module.css"

type Offers = components["schemas"]["HotelOffers"]
type Room = components["schemas"]["SupplierRoom"]

export function RoomCatalog({
  hotelId,
  rooms,
  content,
}: {
  readonly hotelId: string
  readonly rooms: readonly Room[]
  readonly content?: Offers | undefined
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [selected, setSelected] = useHotelRoom(
    hotelId,
    content?.check_in ?? "",
    content?.check_out ?? "",
    content?.adults ?? 0,
  )
  const returnTo = useRef<string | undefined>(undefined)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  useEffect(() => {
    if (!selected && returnTo.current) {
      buttons.current.get(returnTo.current)?.focus()
      returnTo.current = undefined
    }
  }, [selected])
  const offers = content?.offers ?? []
  const room = rooms.find((item) => item.id === selected)
  if (room)
    return (
      <RoomView
        key={room.id}
        room={room}
        offers={offers.filter((item) => item.room_group_id === room.id)}
        onBack={() => {
          returnTo.current = room.id
          setSelected(undefined)
        }}
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
          const prices = (content ? minimumOffers({ ...content, offers: rates }) : []).map(
            (offer) =>
              new Intl.NumberFormat(locale, {
                style: "currency",
                currency: offer.price_currency,
              }).format(offer.price_amount),
          )
          return (
            <li key={item.id}>
              <Card className={styles.card} title={<span lang="ru">{item.name}</span>}>
                <HotelThumb
                  className={styles.thumbnail}
                  photos={item.photos.map((url) => ({ url, kind: "room" }))}
                />
                {item.bedding ? <p lang="ru">{item.bedding}</p> : null}
                {prices.map((price) => (
                  <p key={price}>{t("explore:offers.fromPrice", { price })}</p>
                ))}
                {content && !prices.length ? <p>{t("explore:rooms.noRate")}</p> : null}
                {prices.length ? <p>{t("explore:offers.stayTotal")}</p> : null}
                <Button
                  ref={(node) => {
                    if (node) buttons.current.set(item.id, node)
                    else buttons.current.delete(item.id)
                  }}
                  variant="secondary"
                  icon="room"
                  onClick={() => setSelected(item.id)}
                >
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
