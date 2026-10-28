import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import { DetailsSection } from "../details-section/details-section"
import styles from "./hotel-stay-details.module.css"

type Supplier = components["schemas"]["SupplierDetails"]

export function useHeroFacts(supplier: Supplier | undefined) {
  const { t } = useTranslation()
  if (!supplier) return []
  const { rooms_number: rooms, floors_number: floors, year_built: built } = supplier.facts
  const renovated = supplier.facts.year_renovated
  return [
    supplier.check_in_from
      ? t("explore:hotelCover.checkIn", { time: supplier.check_in_from })
      : undefined,
    supplier.check_out_until
      ? t("explore:hotelCover.checkOut", { time: supplier.check_out_until })
      : undefined,
    rooms ? t("explore:hotelCover.rooms", { count: rooms }) : undefined,
    floors ? t("explore:hotelCover.floors", { count: floors }) : undefined,
    built ? t("explore:hotelCover.built", { year: built }) : undefined,
    renovated ? t("explore:hotelCover.renovated", { year: renovated }) : undefined,
  ].filter((text): text is string => Boolean(text))
}

export function HotelStayDetails({ supplier }: { readonly supplier: Supplier }) {
  const { t } = useTranslation()
  const facts = useHeroFacts(supplier)
  const times = [
    supplier.check_in_from
      ? {
          label: t("explore:hotelCard.checkIn"),
          value: t("explore:hotelCard.fromTime", { time: supplier.check_in_from }),
        }
      : undefined,
    supplier.check_out_until
      ? {
          label: t("explore:hotelCard.checkOut"),
          value: t("explore:hotelCard.untilTime", { time: supplier.check_out_until }),
        }
      : undefined,
  ].filter((row) => row !== undefined)
  if (!facts.length) return null
  const building = facts.slice(times.length)
  return (
    <div className={styles.details}>
      {times.length ? (
        <DetailsSection title={t("explore:hotelCard.stayConditions")} collapsible>
          <dl className={styles.stay}>
            {times.map(({ label, value }) => (
              <div key={label}>
                <dt className={styles.label}>{label}</dt>
                <dd className={styles.time}>
                  <strong>{value}</strong>
                </dd>
              </div>
            ))}
          </dl>
        </DetailsSection>
      ) : null}
      {building.length ? (
        <Disclosure title={t("explore:hotelCard.buildingDetails")}>
          <ul className={styles.list}>
            {building.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </div>
  )
}
