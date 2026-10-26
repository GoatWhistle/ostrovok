import type { components } from "@/shared/api/schema.gen"
import { type MessageKey, useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import styles from "./hotel-offers.module.css"

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

export function SupplierContent({
  content,
}: {
  readonly content: components["schemas"]["HotelOffers"]
}) {
  const { t } = useTranslation()
  const facilities = (content.facilities ?? []).flatMap((code) =>
    FACILITIES[code] ? [FACILITIES[code]] : [],
  )
  return (
    <>
      {content.photo_url ? (
        <img
          className={styles.photo}
          src={content.photo_url}
          alt={t("explore:offers.hotelPhoto")}
          loading="lazy"
        />
      ) : null}
      {content.status === "available" ? <p role="status">{t("explore:offers.available")}</p> : null}
      {facilities.length ? (
        <Disclosure title={t("explore:offers.facilitiesTitle")} icon="check" defaultOpen>
          <p className={styles.note}>{t("explore:offers.facilitiesNote")}</p>
          <ul className={styles.meta}>
            {facilities.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </>
  )
}
