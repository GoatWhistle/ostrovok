import { useEffect, useRef } from "react"
import { minimumOffers, useHotelRoom } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { useLocale } from "@/shared/i18n"
import { OfferCard } from "./offer-card"
import { RoomRow } from "./room-row"
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
  function priceOf(id: string) {
    if (!content) return undefined
    const cheapest = minimumOffers({
      ...content,
      offers: offers.filter((offer) => offer.room_group_id === id),
    })[0]
    return cheapest
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency: cheapest.price_currency,
          maximumFractionDigits: 0,
        }).format(cheapest.price_amount)
      : undefined
  }
  return (
    <ul className={styles.rows}>
      {rooms.map((item) => (
        <RoomRow
          key={item.id}
          room={item}
          price={priceOf(item.id)}
          priced={Boolean(content)}
          buttonRef={(node) => {
            if (node) buttons.current.set(item.id, node)
            else buttons.current.delete(item.id)
          }}
          onOpen={() => setSelected(item.id)}
        />
      ))}
      {ungrouped.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </ul>
  )
}
