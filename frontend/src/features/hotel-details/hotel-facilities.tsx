import { useLocale, useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import styles from "./hotel-facilities.module.css"

export interface HotelFacilitiesProps {
  readonly facilitiesRu: readonly string[]
  readonly facilitiesEn: readonly string[]
}

export function HotelFacilities({ facilitiesRu, facilitiesEn }: HotelFacilitiesProps) {
  const { locale } = useLocale()
  const { t } = useTranslation()
  const facilities = locale === "ru" ? facilitiesRu : facilitiesEn
  if (!facilities.length) return null
  return (
    <Disclosure title={t("explore:details.facilities", { count: facilities.length })} icon="check">
      <p className={styles.source}>{t("explore:details.facilitiesSource")}</p>
      <ul className={styles.list}>
        {facilities.map((facility) => (
          <li key={facility}>{facility}</li>
        ))}
      </ul>
    </Disclosure>
  )
}
