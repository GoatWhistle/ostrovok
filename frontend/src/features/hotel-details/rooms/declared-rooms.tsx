import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Card } from "@/shared/ui"
import { roomFacts, viewKeys } from "./room-facts"
import styles from "./rooms.module.css"

type Room = components["schemas"]["SupplierRoom"]

export function DeclaredRooms({
  rooms,
  card,
}: {
  readonly rooms: readonly Room[]
  readonly card: string
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const number = new Intl.NumberFormat(locale)
  const host = cardHost(card)
  if (!rooms.length || !host) return null
  return (
    <section className={styles.declared} aria-labelledby="declared-rooms-title">
      <p id="declared-rooms-title" className={styles.title}>
        {t("explore:roomsScreen.declaredTitle")}
      </p>
      <p className={styles.rowDetails}>{t("explore:roomsScreen.declaredFrom", { source: host })}</p>
      <ul className={styles.list}>
        {rooms.map((room) => {
          const facts = roomFacts(room, {
            area: (value) => t("explore:roomsScreen.area", { value: number.format(value) }),
            floor: (value) => t("explore:roomsScreen.floor", { value }),
            places: (value) => t("explore:roomsScreen.places", { value }),
            extraPlaces: (value) => t("explore:roomsScreen.extraPlaces", { value }),
          })
          const views = viewKeys(room)
          return (
            <li key={room.id}>
              <Card className={styles.declaredRow} title={<span lang="ru">{room.name}</span>}>
                {views.length ? (
                  <ul className={styles.tags}>
                    {views.map((key) => (
                      <li key={key} className={styles.tag}>
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {facts.length ? (
                  <span className={styles.rowDetails} lang="ru">
                    {facts.join(", ")}
                  </span>
                ) : null}
              </Card>
            </li>
          )
        })}
      </ul>
      <a className={styles.declaredLink} href={card} target="_blank" rel="noreferrer">
        {t("explore:roomsScreen.declaredLink")}
      </a>
    </section>
  )
}

function cardHost(card: string): string | undefined {
  try {
    return new URL(card).host
  } catch {
    return undefined
  }
}
