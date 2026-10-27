import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Icon, type IconName, NoValue } from "@/shared/ui"
import styles from "./room-list.module.css"

type Room = NonNullable<components["schemas"]["HotelCard"]["rooms"]>[number]

export interface RoomListProps {
  readonly rooms: readonly Room[]
}

function RoomFact({ icon, children }: { readonly icon: IconName; readonly children: string }) {
  return (
    <li className={styles.fact}>
      <Icon name={icon} size="sm" />
      <span>{children}</span>
    </li>
  )
}

export function RoomList({ rooms }: RoomListProps) {
  const { t } = useTranslation()
  return (
    <ul className={styles.rooms}>
      {rooms.map((room, index) => (
        <li key={room.id ?? `room-${index}`} className={styles.room}>
          <span className={styles.name} lang="ru">
            <Icon name="room" size="sm" className={styles.icon} />
            {room.name ?? <NoValue />}
          </span>
          <ul className={styles.facts}>
            {room.capacity ? (
              <RoomFact icon="guests">
                {t("explore:details.roomCapacity", { count: room.capacity })}
              </RoomFact>
            ) : null}
            {room.floor_range?.length ? (
              <RoomFact icon="height">
                {t("explore:details.roomFloor", {
                  min: room.floor_range[0],
                  max: room.floor_range[1] ?? room.floor_range[0],
                })}
              </RoomFact>
            ) : null}
            <RoomFact icon="calendar">
              {room.price_amount != null && room.price_currency
                ? t("explore:cards.catalogPrice", {
                    amount: room.price_amount,
                    currency: room.price_currency,
                  })
                : t("explore:details.roomPriceUnknown")}
            </RoomFact>
            <RoomFact icon="sunset">
              {room.facade_ids?.length
                ? t("explore:cards.facadeCount", { count: room.facade_ids.length })
                : t("explore:details.roomSideUnknown")}
            </RoomFact>
            <RoomFact icon="check">
              {room.included?.length
                ? t("explore:details.roomIncluded", { value: room.included.join(", ") })
                : t("explore:details.roomIncludedUnknown")}
            </RoomFact>
          </ul>
        </li>
      ))}
    </ul>
  )
}
