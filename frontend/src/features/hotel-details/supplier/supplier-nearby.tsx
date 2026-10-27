import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import styles from "./supplier.module.css"

type Place = components["schemas"]["SupplierNearbyPlace"]

export function SupplierNearby({ places }: { readonly places: readonly Place[] }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  if (!places.length) return null
  const metres = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const kilometres = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return (
    <Disclosure title={t("explore:supplier.nearby", { count: places.length })} icon="pin">
      <p className={styles.label}>{t("explore:supplier.nearbyNote")}</p>
      <ul className={styles.places}>
        {places.map((place) => (
          <li key={`${place.name}:${place.distance_m}`} className={styles.place}>
            <span lang="ru">{place.name}</span>
            <span className={styles.distance}>
              {place.distance_m < 1000
                ? t("explore:supplier.metres", { value: metres.format(place.distance_m) })
                : t("explore:supplier.kilometres", {
                    value: kilometres.format(place.distance_m / 1000),
                  })}
            </span>
          </li>
        ))}
      </ul>
    </Disclosure>
  )
}
