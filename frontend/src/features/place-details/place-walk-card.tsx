import { type PlaceCard, walkLabel } from "@/entities/place"
import { useFormatters, useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card } from "@/shared/ui"
import styles from "./place-details.module.css"

export function PlaceWalkCard({
  walk,
  onRoute,
}: {
  readonly walk: PlaceCard["walk"]
  readonly onRoute: (ref: string) => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const format = useFormatters()
  if (!walk) return <p>{t("explore:place.noRoute")}</p>
  if (walk.mode === "onsite")
    return (
      <Card className={styles.walk}>
        <strong>{t("explore:place.onsite")}</strong>
        <Button variant="secondary" icon="map" onClick={() => onRoute(walk.geo_ref)}>
          {t("explore:chat.showOnMap")}
        </Button>
      </Card>
    )
  return (
    <Card className={styles.walk} title={t("explore:place.fromHotel")}>
      <strong>{walkLabel(walk.minutes, walk.distance_m, locale)}</strong>
      <p>{t("explore:place.meters", { value: format.integer(walk.distance_m) })}</p>
      {walk.mode === "straight" ? <p>{t("explore:place.noGraph")}</p> : null}
      <Button variant="secondary" icon="walk" onClick={() => onRoute(walk.geo_ref)}>
        {t("explore:place.showRoute")}
      </Button>
    </Card>
  )
}
