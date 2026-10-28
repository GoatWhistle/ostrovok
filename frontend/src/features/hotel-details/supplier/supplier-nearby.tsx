import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { DetailsSection } from "../details-section/details-section"
import styles from "./supplier.module.css"

type Place = components["schemas"]["SupplierNearbyPlace"]

function useDistance() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const metres = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const kilometres = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return (distance: number) =>
    distance < 1000
      ? t("explore:supplier.metres", { value: metres.format(distance) })
      : t("explore:supplier.kilometres", { value: kilometres.format(distance / 1000) })
}

function Places({ places, id }: { readonly places: readonly Place[]; readonly id?: string }) {
  const distance = useDistance()
  return (
    <ul id={id} className={styles.places}>
      {places.map((place) => (
        <li key={`${place.name}:${place.distance_m}`} className={styles.place}>
          <span lang="ru">{place.name}</span>
          <span className={styles.distance}>{distance(place.distance_m)}</span>
        </li>
      ))}
    </ul>
  )
}

export function SupplierNearby({
  places,
  heading = true,
}: {
  readonly places: readonly Place[]
  readonly heading?: boolean
}) {
  const { t } = useTranslation()
  if (!places.length) return null
  const sorted = [...places].sort((a, b) => a.distance_m - b.distance_m)
  const content = <Places places={sorted} />
  return heading ? (
    <DetailsSection title={t("explore:supplier.nearby")}>{content}</DetailsSection>
  ) : (
    content
  )
}
