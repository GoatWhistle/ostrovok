import { useEffect, useId, useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Tabs } from "@/shared/ui"
import type { HotelDetailsProps } from "../hotel-details/hotel-details"
import { SupplierNearby } from "../supplier/supplier-nearby"
import { HotelAmenities } from "./hotel-amenities"
import styles from "./hotel-card-panels.module.css"
import { HotelOverview } from "./hotel-overview"
import { HotelPaidServices } from "./hotel-paid-services"
import { paidServices } from "./paid-services"

export interface HotelCardPanelsProps extends Omit<HotelDetailsProps, "hotelId" | "className"> {
  readonly card: components["schemas"]["HotelCard"]
  readonly supplier: components["schemas"]["SupplierDetails"] | undefined
  readonly onRooms: () => void
}

type Panel = "about" | "nearby" | "amenities" | "paid"

export function HotelCardPanels(props: HotelCardPanelsProps) {
  const { t } = useTranslation()
  const { card, supplier } = props
  const services = paidServices(card.facts, card.conflicts)
  const options: { value: Panel; label: string }[] = [
    { value: "about", label: t("explore:hotelCard.about") },
    { value: "nearby", label: t("explore:hotelCard.nearby") },
    { value: "amenities", label: t("explore:hotelCard.amenities") },
  ]
  if (services.length) options.push({ value: "paid", label: t("explore:hotelCard.paid") })
  const id = useId()
  const [selected, setSelected] = useState<Panel>("about")
  const current = options.find((option) => option.value === selected)?.value ?? "about"
  useEffect(() => setSelected(current), [current])
  const tabOptions = options.map((option) => ({
    ...option,
    id: `${id}-${option.value}`,
    panelId: `${id}-panel-${option.value}`,
  }))
  function content(panel: Panel) {
    if (panel === "about") return <HotelOverview {...props} />
    if (panel === "paid") return <HotelPaidServices services={services} onFact={props.onFact} />
    if (panel === "amenities") return <HotelAmenities card={card} supplier={supplier} />
    return (
      <div className={styles.nearby}>
        {supplier?.nearby.length ? (
          <SupplierNearby places={supplier.nearby} heading={false} />
        ) : (
          <p className={styles.empty}>{t("explore:hotelCard.nearbyEmpty")}</p>
        )}
      </div>
    )
  }
  return (
    <div className={styles.sections}>
      <Tabs
        label={t("explore:hotelCard.tabs")}
        options={tabOptions}
        value={current}
        onChange={setSelected}
        compact
      />
      {tabOptions.map((option) => (
        <div
          key={option.value}
          id={option.panelId}
          role="tabpanel"
          aria-labelledby={option.id}
          className={styles.panel}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: static tab panels must be keyboard reachable
          tabIndex={0}
          hidden={current !== option.value}
        >
          {current === option.value ? content(option.value) : null}
        </div>
      ))}
    </div>
  )
}
