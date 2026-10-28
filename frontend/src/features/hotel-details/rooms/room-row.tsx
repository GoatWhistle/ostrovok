import { RowButton } from "@/entities/evidence"
import type { components } from "@/shared/api/schema.gen"
import { sourceUrl } from "@/shared/api/source-url"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import { roomFacts } from "./room-facts"
import styles from "./rooms.module.css"

type Room = components["schemas"]["SupplierRoom"]

export function RoomRow({
  room,
  price,
  priced,
  buttonRef,
  onOpen,
}: {
  readonly room: Room
  readonly price: string | undefined
  readonly priced: boolean
  readonly buttonRef: (node: HTMLButtonElement | null) => void
  readonly onOpen: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const photo = room.photos.map((url) => sourceUrl(url)).find(Boolean)
  const number = new Intl.NumberFormat(locale)
  const details = roomFacts(room, {
    area: (value) => t("explore:roomsScreen.area", { value: number.format(value) }),
    floor: (value) => t("explore:roomsScreen.floor", { value }),
    places: (value) => t("explore:roomsScreen.places", { value }),
    extraPlaces: (value) => t("explore:roomsScreen.extraPlaces", { value }),
  })
  return (
    <li>
      <RowButton
        ref={buttonRef}
        className={styles.row}
        leading={
          photo ? (
            <img className={styles.rowPhoto} src={photo} alt="" loading="lazy" />
          ) : (
            <span className={styles.rowPhoto} data-empty>
              <Icon name="room" />
            </span>
          )
        }
        trailing={<Icon name="chevron-right" size="sm" />}
        onClick={onOpen}
      >
        <span className={styles.rowName} lang="ru">
          {room.name}
        </span>
        {details.length ? (
          <span className={styles.rowDetails} lang="ru">
            {details.join(", ")}
          </span>
        ) : null}
        {price ? (
          <span className={styles.rowPrice}>{t("explore:offers.fromPrice", { price })}</span>
        ) : priced ? (
          <span className={styles.rowDetails}>{t("explore:roomsScreen.noRate")}</span>
        ) : null}
      </RowButton>
    </li>
  )
}
