import { FactStatusBadge, FactTile, RowButton, SourceBadge } from "@/entities/evidence"
import type { Fact, FactBrief } from "@/shared/api/hotel-types"
import { characteristicTitle, factLabel } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Confidence, Icon } from "@/shared/ui"
import { DetailsSection } from "./details-section"
import styles from "./fact-list.module.css"

export interface FactListProps {
  readonly facts: readonly Fact[]
  readonly onFact: (fact: FactBrief) => void
}

interface FactGroup {
  readonly fact: Fact
  readonly count: number
}

function groupFacts(facts: readonly Fact[]): FactGroup[] {
  const groups = new Map<string, FactGroup>()
  for (const fact of facts) {
    const current = groups.get(fact.characteristic_key)
    if (!current) groups.set(fact.characteristic_key, { fact, count: 1 })
    else
      groups.set(fact.characteristic_key, {
        fact: fact.confidence > current.fact.confidence ? fact : current.fact,
        count: current.count + 1,
      })
  }
  return [...groups.values()]
}

export function FactList({ facts, onFact }: FactListProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const groups = groupFacts(facts)
  return (
    <DetailsSection title={t("explore:details.facts")}>
      {groups.length ? (
        <ul className={styles.list}>
          {groups.map(({ fact, count }) => {
            const title = characteristicTitle(fact.characteristic_key, locale)
            return (
              <li key={fact.characteristic_key}>
                <RowButton
                  leadingAlign="start"
                  leading={<FactTile characteristicKey={fact.characteristic_key} size="sm" />}
                  trailing={<Icon name="chevron-right" size="sm" className={styles.chevron} />}
                  onClick={() => onFact(fact)}
                >
                  <span className={styles.value}>{factLabel(fact, locale)}</span>
                  {title !== fact.characteristic_key ? (
                    <span className={styles.title}>{title}</span>
                  ) : null}
                  <span className={styles.badges}>
                    <SourceBadge source={fact.source_type} />
                    <Confidence value={fact.confidence} />
                    <FactStatusBadge status={fact.status} />
                    {count > 1 ? (
                      <span className={styles.title}>
                        {t("explore:details.facadeValues", { count })}
                      </span>
                    ) : null}
                  </span>
                </RowButton>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={styles.empty}>{t("explore:details.factsEmpty")}</p>
      )}
    </DetailsSection>
  )
}
