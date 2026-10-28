import { useId, useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import { DetailsSection } from "../details-section"
import styles from "./supplier.module.css"

type Place = components["schemas"]["SupplierNearbyPlace"]

const VISIBLE = 5

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

export function SupplierNearby({ places }: { readonly places: readonly Place[] }) {
  const { t } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  if (!places.length) return null
  const sorted = [...places].sort((a, b) => a.distance_m - b.distance_m)
  const rest = sorted.length - VISIBLE
  return (
    <DetailsSection title={t("explore:supplier.nearby")} hint={t("explore:supplier.nearbyNote")}>
      <Places id={id} places={open ? sorted : sorted.slice(0, VISIBLE)} />
      {rest > 0 ? (
        <Button
          variant="ghost"
          size="compact"
          className={styles.more}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          {open
            ? t("explore:supplier.showLess")
            : t("explore:supplier.moreNearby", { count: rest })}
        </Button>
      ) : null}
    </DetailsSection>
  )
}
