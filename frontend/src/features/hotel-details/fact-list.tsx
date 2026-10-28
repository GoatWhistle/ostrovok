import { FactStatusBadge, HueIcon, RowButton } from "@/entities/evidence"
import type { Fact, FactBrief } from "@/shared/api/hotel-types"
import { characteristicTitle, factLabel } from "@/shared/geo/fact-label"
import { factScope } from "@/shared/geo/facts/scope"
import { wishVerdict } from "@/shared/geo/facts/wish-verdict"
import { type Locale, useLocale, useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import { DetailsSection } from "./details-section"
import styles from "./fact-list.module.css"

export interface FactListProps {
  readonly title?: string
  readonly facts: readonly Fact[]
  readonly onFact: (fact: FactBrief) => void
}

interface FactGroup {
  readonly fact: Fact
  readonly count: number
}

function priority(fact: Fact): number {
  return (
    (fact.status === "active" || fact.status === "confirmed_by_hotelier" ? 1 : 0) +
    fact.confidence / 2
  )
}

function groupFacts(facts: readonly Fact[]): FactGroup[] {
  const groups = new Map<string, FactGroup>()
  for (const fact of facts) {
    const current = groups.get(fact.characteristic_key)
    if (!current) groups.set(fact.characteristic_key, { fact, count: 1 })
    else
      groups.set(fact.characteristic_key, {
        fact: priority(fact) > priority(current.fact) ? fact : current.fact,
        count: current.count + 1,
      })
  }
  return [...groups.values()]
}

function words(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function restates(title: string, value: string): boolean {
  const seen = new Set(words(value))
  return title === "" || words(title).every((word) => seen.has(word))
}

function sameNumbers(note: string, value: string): boolean {
  const numbers = words(note).filter((word) => /^\p{N}+$/u.test(word))
  const seen = new Set(words(value))
  return numbers.length > 0 && numbers.every((word) => seen.has(word))
}

function useFactNotes(locale: Locale) {
  const { t } = useTranslation()
  return (fact: Fact, value: string, count: number): string[] => {
    const verdict = wishVerdict(
      { characteristic_key: fact.characteristic_key, match: "full", label: fact.label, fact },
      locale,
    )
    if (verdict && !restates(verdict, value) && !sameNumbers(verdict, value)) return [verdict]
    const title = characteristicTitle(fact.characteristic_key, locale)
    return [
      title !== fact.characteristic_key && !restates(title, value) ? title : undefined,
      ...factScope(fact, locale),
      count > 1 ? t("explore:details.facadeValues", { count }) : undefined,
    ].filter((note): note is string => Boolean(note))
  }
}

export function FactList({ facts, onFact, title: heading }: FactListProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const groups = groupFacts(facts)
  const factNotes = useFactNotes(locale)
  return (
    <DetailsSection title={heading ?? t("explore:details.facts")}>
      {groups.length ? (
        <ul className={styles.list}>
          {groups.map(({ fact, count }) => {
            const value = factLabel(fact, locale)
            const notes = factNotes(fact, value, count)
            const settled = fact.status === "active" || fact.status === "confirmed_by_hotelier"
            return (
              <li key={fact.characteristic_key}>
                <RowButton
                  leadingAlign="start"
                  leading={<HueIcon characteristicKey={fact.characteristic_key} />}
                  trailing={<Icon name="chevron-right" size="sm" className={styles.chevron} />}
                  data-fact-trigger={fact.fact_id}
                  onClick={() => onFact(fact)}
                >
                  <span className={styles.value}>{value}</span>
                  {notes.length ? <span className={styles.title}>{notes.join("; ")}</span> : null}
                  {settled ? null : (
                    <span className={styles.badges}>
                      <FactStatusBadge status={fact.status} />
                    </span>
                  )}
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
