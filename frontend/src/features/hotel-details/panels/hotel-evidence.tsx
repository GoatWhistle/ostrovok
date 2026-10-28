import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Banner, Disclosure } from "@/shared/ui"
import { ConflictValues } from "../conflict-values/conflict-values"
import { FactSources } from "../fact-sources/fact-sources"
import type { HotelDetailsProps } from "../hotel-details/hotel-details"
import styles from "./hotel-evidence.module.css"

export function HotelEvidence({
  card,
  onFact,
}: {
  readonly card: components["schemas"]["HotelCard"]
  readonly onFact: HotelDetailsProps["onFact"]
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.sources}>
      <Disclosure title={t("explore:cards.allEvidence")} icon="source" revealOnOpen>
        {card.conflicts?.length ? (
          <Banner tone="warning" icon="alert" title={t("explore:details.conflicts")}>
            {t("explore:details.conflictsText")}
            <ConflictValues conflicts={card.conflicts} facts={card.facts} />
          </Banner>
        ) : null}
        {card.stale_count ? (
          <Banner
            tone="neutral"
            icon="stale"
            title={t("explore:details.staleCount", { count: card.stale_count })}
          >
            {t("explore:details.staleText")}
          </Banner>
        ) : null}
        <FactSources facts={card.facts} onFact={onFact} />
      </Disclosure>
    </div>
  )
}
