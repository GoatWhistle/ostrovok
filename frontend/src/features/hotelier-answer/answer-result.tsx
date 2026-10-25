import { FactTile, SourceBadge } from "@/entities/evidence"
import type { components } from "@/shared/api/schema.gen"
import { factLabel } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner } from "@/shared/ui"
import styles from "./answer-result.module.css"

interface AnswerResponse {
  readonly extracted?: readonly components["schemas"]["Fact"][]
  readonly conflicts?: readonly components["schemas"]["Conflict"][]
  readonly follow_up?: components["schemas"]["HotelierQuestion"]
}

export interface AnswerResultProps {
  readonly result: AnswerResponse
}

export function AnswerResult({ result }: AnswerResultProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const extracted = result.extracted ?? []
  return (
    <div className={styles.result}>
      <Banner tone="success" title={t("explore:hotelier.saved")} />
      {extracted.length ? (
        <div className={styles.facts}>
          <p className={styles.label}>{t("explore:hotelier.extracted")}</p>
          <ul className={styles.list}>
            {extracted.map((fact) => (
              <li key={fact.fact_id} className={styles.fact}>
                <FactTile characteristicKey={fact.characteristic_key} size="sm" />
                <span className={styles.value}>{factLabel(fact, locale)}</span>
                <SourceBadge source={fact.source_type} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.conflicts?.length ? (
        <Banner tone="warning" icon="alert" title={t("explore:hotelier.conflicts")}>
          {t("explore:hotelier.conflictsText")}
        </Banner>
      ) : null}
      {result.follow_up?.text ? (
        <Banner tone="info" title={t("explore:hotelier.followUp")}>
          <span lang="ru">{result.follow_up.text}</span>
        </Banner>
      ) : null}
    </div>
  )
}
