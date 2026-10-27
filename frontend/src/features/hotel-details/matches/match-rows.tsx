import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import { isUsableMatch } from "@/shared/geo/facts/matching"
import { useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import { DetailsSection } from "../details-section"
import { MatchItem } from "./match-item"
import styles from "./match-rows.module.css"

export interface MatchRowsProps {
  readonly matched: readonly MatchedProperty[]
  readonly onProperty: ((property: MatchedProperty) => void) | undefined
  readonly onFact: (fact: FactBrief) => void
  readonly onPreview: ((property: MatchedProperty | undefined) => void) | undefined
}

export function MatchRows({ matched, ...actions }: MatchRowsProps) {
  const { t } = useTranslation()
  const found = matched.filter(isUsableMatch)
  const remaining = [...found.slice(3), ...matched.filter((item) => !isUsableMatch(item))]
  const rows = (items: readonly MatchedProperty[]) => (
    <ul className={styles.list}>
      {items.map((item) => (
        <MatchItem key={item.characteristic_key} item={item} {...actions} />
      ))}
    </ul>
  )
  return (
    <DetailsSection title={t("explore:details.yourRequest")}>
      {found.length ? rows(found.slice(0, 3)) : <p>{t("explore:cards.noConfirmedWishes")}</p>}
      {remaining.length ? (
        <Disclosure title={t("explore:cards.moreWishes", { count: remaining.length })} icon="list">
          {rows(remaining)}
        </Disclosure>
      ) : null}
    </DetailsSection>
  )
}
