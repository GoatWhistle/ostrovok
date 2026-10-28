import { useHotelOffers, useHotelStay } from "@/entities/hotel"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import styles from "./hotel-facilities.module.css"

const FACILITIES: Readonly<Record<string, MessageKey>> = {
  has_internet: "explore:offers.facilities.internet",
  has_airport_transfer: "explore:offers.facilities.transfer",
  has_parking: "explore:offers.facilities.parking",
  has_kids: "explore:offers.facilities.kids",
  has_pool: "explore:offers.facilities.pool",
  has_fitness: "explore:offers.facilities.fitness",
  has_meal: "explore:offers.facilities.meal",
  has_busyness: "explore:offers.facilities.business",
  has_spa: "explore:offers.facilities.spa",
  beach: "explore:offers.facilities.beach",
  "air-conditioning": "explore:offers.facilities.airConditioning",
  has_pets: "explore:offers.facilities.pets",
  has_disabled_support: "explore:offers.facilities.accessibility",
}
interface HotelFacilitiesProps {
  readonly open?: boolean | undefined
  readonly onOpenChange?: ((open: boolean) => void) | undefined
  readonly emptyText?: string
  readonly hotelId: string
  readonly facilitiesRu: readonly string[]
  readonly facilitiesEn: readonly string[]
}
export function HotelFacilities({
  hotelId,
  facilitiesRu,
  facilitiesEn,
  emptyText,
  open,
  onOpenChange,
}: HotelFacilitiesProps) {
  const { locale } = useLocale()
  const { t } = useTranslation()
  const { value } = useHotelStay()
  const offers = useHotelOffers(hotelId, value.checkIn, value.checkOut, value.adults)
  const supplier = (offers.data?.facilities ?? []).flatMap((code) =>
    FACILITIES[code] ? [t(FACILITIES[code])] : [],
  )
  const facilities = [
    ...new Set(
      [...(locale === "ru" ? facilitiesRu : facilitiesEn), ...supplier]
        .map((text) => text.trim())
        .filter(Boolean),
    ),
  ]
  if (!facilities.length) return emptyText ? <p className={styles.source}>{emptyText}</p> : null
  const rows = (items: string[]) => (
    <ul className={styles.list}>
      {items.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  )
  return (
    <Disclosure
      icon="building"
      title={t("explore:supplierAmenityGroup.general")}
      open={open}
      onOpenChange={onOpenChange}
    >
      {rows(facilities)}
    </Disclosure>
  )
}
