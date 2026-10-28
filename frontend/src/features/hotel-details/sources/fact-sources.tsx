import { RowButton, sourceIcon } from "@/entities/evidence"
import type { Fact, FactBrief } from "@/shared/api/hotel-types"
import { factLabel } from "@/shared/geo/facts/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import { groupFacts } from "../fact-list"
import styles from "./fact-sources.module.css"

export interface FactSourcesProps {
  readonly facts: readonly Fact[]
  readonly onFact: (fact: FactBrief) => void
}

function factDate(fact: Fact): string | undefined {
  return fact.provenance?.observed_at ?? fact.provenance?.computed_at ?? undefined
}

export function FactSources({ facts, onFact }: FactSourcesProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const dates = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" })
  const groups = groupFacts(facts.filter((fact) => !fact.characteristic_key.startsWith("derived:")))
  if (!groups.length) return <p className={styles.empty}>{t("explore:details.factsEmpty")}</p>
  return (
    <ul className={styles.list}>
      {groups.map(({ fact }) => {
        const date = factDate(fact)
        return (
          <li key={fact.characteristic_key}>
            <RowButton
              leading={
                <Icon name={sourceIcon(fact.source_type)} size="sm" className={styles.icon} />
              }
              data-fact-trigger={fact.fact_id}
              onClick={() => onFact(fact)}
              trailing={
                <span className={styles.meta}>
                  <span>{t(`explore:source.${fact.source_type}`)}</span>
                  {date ? (
                    <time dateTime={date} className={styles.date}>
                      {dates.format(new Date(date))}
                    </time>
                  ) : null}
                </span>
              }
            >
              <span className={styles.fact}>{factLabel(fact, locale)}</span>
            </RowButton>
          </li>
        )
      })}
    </ul>
  )
}
