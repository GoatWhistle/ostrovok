import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import styles from "./supplier.module.css"

type Facts = components["schemas"]["SupplierFacts"]
type Rating = components["schemas"]["SupplierRating"]

interface Entry {
  readonly key: string
  readonly label: string
  readonly value: string
}

export function SupplierFacts({
  facts,
  rating,
  checkIn,
  checkOut,
}: {
  readonly facts: Facts
  readonly rating: Rating | null | undefined
  readonly checkIn: string | null | undefined
  readonly checkOut: string | null | undefined
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const number = new Intl.NumberFormat(locale)
  const entries: Entry[] = []
  function add(key: string, label: string, value: string | undefined) {
    if (value) entries.push({ key, label, value })
  }
  add(
    "floors",
    t("explore:supplier.floors"),
    facts.floors_number ? number.format(facts.floors_number) : undefined,
  )
  add(
    "rooms",
    t("explore:supplier.rooms"),
    facts.rooms_number ? number.format(facts.rooms_number) : undefined,
  )
  add(
    "stars",
    t("explore:supplier.stars"),
    facts.star_rating ? number.format(facts.star_rating) : undefined,
  )
  add("built", t("explore:supplier.built"), facts.year_built ? String(facts.year_built) : undefined)
  add(
    "renovated",
    t("explore:supplier.renovated"),
    facts.year_renovated ? String(facts.year_renovated) : undefined,
  )
  add("checkIn", t("explore:supplier.checkIn"), checkIn ?? undefined)
  add("checkOut", t("explore:supplier.checkOut"), checkOut ?? undefined)
  add(
    "rating",
    t("explore:supplier.rating"),
    rating?.total
      ? t("explore:supplier.ratingValue", {
          score: rating.total,
          count: rating.reviews_count ?? 0,
        })
      : undefined,
  )
  const registry = facts.registry
  if (!entries.length && !registry) return null
  return (
    <div className={styles.block}>
      {entries.length ? (
        <ul className={styles.grid}>
          {entries.map((entry) => (
            <li key={entry.key} className={styles.fact}>
              <span className={styles.label}>{entry.label}</span>
              <span className={styles.value}>{entry.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {registry ? (
        <p className={styles.label}>
          {t("explore:supplier.registry", { record: registry.record })}
          {registry.link ? (
            <a
              className={styles.link}
              href={registry.link}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Icon name="source" size="sm" />
              {t("explore:supplier.registryLink")}
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
