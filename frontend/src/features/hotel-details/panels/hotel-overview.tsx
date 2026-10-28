import { isAvailableFact } from "@/shared/geo/facts/matching"
import { useTranslation } from "@/shared/i18n"
import { FactList } from "../fact-list/fact-list"
import { MatchRows } from "../match-rows/match-rows"
import { RoomsTeaser } from "../rooms/rooms-teaser"
import { SupplierNarrative } from "../supplier/supplier-narrative"
import type { HotelCardPanelsProps } from "./hotel-card-panels"
import { HotelEvidence } from "./hotel-evidence"
import styles from "./hotel-overview.module.css"
import { HotelStayDetails } from "./hotel-stay-details"

export function HotelOverview({
  card,
  supplier,
  matched = [],
  stay,
  onRooms,
  onProperty,
  onFact,
  onPreview,
}: HotelCardPanelsProps) {
  const { t } = useTranslation()
  const views = card.facts.filter(
    (fact) =>
      isAvailableFact(fact) &&
      !matched.some((item) => item.fact?.fact_id === fact.fact_id) &&
      (fact.characteristic_key === "sunset_view" || fact.characteristic_key.startsWith("spatial:")),
  )
  return (
    <div className={styles.overview}>
      {supplier ? <SupplierNarrative sections={supplier.description} topic="about" /> : null}
      {matched.length ? (
        <MatchRows
          matched={matched}
          onProperty={onProperty}
          onFact={onFact}
          onPreview={onPreview}
        />
      ) : (
        <FactList
          collapsible
          facts={card.facts.filter(
            (fact) => isAvailableFact(fact) && !fact.characteristic_key.startsWith("derived:"),
          )}
          onFact={onFact}
        />
      )}
      {supplier ? <HotelStayDetails supplier={supplier} /> : null}
      <RoomsTeaser hotelId={card.hotel.id} stay={stay} onOpen={onRooms} />
      {matched.length && views.length ? (
        <FactList title={t("explore:cards.views")} facts={views} onFact={onFact} />
      ) : null}
      <HotelEvidence card={card} onFact={onFact} />
    </div>
  )
}
