import { type PlaceCard, placeKind, placeName, usePlace, walkLabel } from "@/entities/place"
import { useFormatters, useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card, ErrorState, Skeleton } from "@/shared/ui"
import styles from "./place-details.module.css"
import { PlaceField } from "./place-field"
import { PlaceHours } from "./place-hours"

export interface PlaceDetailsProps {
  readonly id: string
  readonly hotelId: string
  readonly date: string
  readonly hour: number
  readonly onBack: () => void
  readonly onRoute: (ref: string) => void
}

function safeWebsite(value: string): string | undefined {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

function DetailsFields({ card, date, hour }: { card: PlaceCard; date: string; hour: number }) {
  const { t } = useTranslation()
  const tags = card.tags
  const fields = [
    "addr:street",
    "addr:housenumber",
    "addr:city",
    "addr:postcode",
    "cuisine",
    "outdoor_seating",
    "wheelchair",
    "phone",
    "contact:phone",
    "website",
    "contact:website",
  ]
  return (
    <>
      <PlaceField card={card} tag="opening_hours" label={t("explore:place.hours")}>
        <PlaceHours value={tags.opening_hours} date={date} hour={hour} />
      </PlaceField>
      {fields
        .filter((key) => tags[key])
        .map((key) => {
          const value = tags[key] ?? ""
          const website = key.endsWith("website") ? safeWebsite(value) : undefined
          const boolean = value === "yes" || value === "no"
          return (
            <PlaceField
              key={key}
              card={card}
              tag={key}
              label={t(`explore:place.fields.${key.replace("contact:", "")}`, {
                defaultValue: key,
              })}
            >
              {website ? (
                <a className={styles.link} href={website} target="_blank" rel="noreferrer">
                  {value}
                </a>
              ) : (
                <p>{boolean ? t(`explore:place.${value}`) : value}</p>
              )}
            </PlaceField>
          )
        })}
      {!tags["addr:street"] ? <p className={styles.meta}>{t("explore:place.noAddress")}</p> : null}
      <p className={styles.meta}>{t("explore:place.missingFields")}</p>
    </>
  )
}

export function PlaceDetails({ id, hotelId, date, hour, onBack, onRoute }: PlaceDetailsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const format = useFormatters()
  const query = usePlace(id, hotelId)
  const card = query.data
  return (
    <section className={styles.detail} aria-label={t("explore:place.title")}>
      <Button variant="ghost" icon="chevron-left" onClick={onBack}>
        {t("explore:place.back")}
      </Button>
      {query.isPending ? <Skeleton lines={5} /> : null}
      {query.isError ? (
        <ErrorState title={t("explore:place.error")} onRetry={() => void query.refetch()} />
      ) : null}
      {card ? (
        <>
          <header className={styles.head}>
            <PlaceField
              card={card}
              tag={
                ["amenity", "tourism", "leisure", "shop", "natural"].find(
                  (key) => card.tags[key],
                ) ?? "amenity"
              }
              label={t("explore:place.kind")}
            >
              <p>{placeKind(card.kind, locale)}</p>
            </PlaceField>
            <PlaceField
              card={card}
              tag={card.tags[`name:${locale}`] ? `name:${locale}` : "name"}
              label={t("explore:place.name")}
            >
              <p className={styles.name}>
                {placeName(card.tags[`name:${locale}`] ?? card.name, card.kind, locale)}
              </p>
            </PlaceField>
            <a href={card.source.url} target="_blank" rel="noreferrer" className={styles.link}>
              {t("explore:place.openOsm")}
            </a>
            <p className={styles.meta}>
              {t("explore:place.fieldSource", {
                ref: card.osm_ref,
                date: format.date(card.source.extracted_at),
                license: card.source.license,
              })}
            </p>
          </header>
          {card.walk ? (
            <Card className={styles.walk} title={t("explore:place.fromHotel")}>
              <strong>{walkLabel(card.walk.minutes, card.walk.distance_m, locale)}</strong>
              <p>{t("explore:place.meters", { value: format.integer(card.walk.distance_m) })}</p>
              {card.walk.mode === "straight" ? <p>{t("explore:place.noGraph")}</p> : null}
              <Button
                variant="secondary"
                icon="walk"
                onClick={() => onRoute(card.walk?.geo_ref ?? "")}
              >
                {t("explore:place.showRoute")}
              </Button>
            </Card>
          ) : (
            <p>{t("explore:place.noRoute")}</p>
          )}
          <DetailsFields card={card} date={date} hour={hour} />
        </>
      ) : null}
    </section>
  )
}
