import { HotelResult, StayBar } from "@/entities/hotel"
import type { MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { EmptyState, Skeleton } from "@/shared/ui"
import { ORDER_KEYS, orderResults, seaDistance } from "./result-order"
import styles from "./search-results.module.css"
import { SortControl } from "./sort-control"
import { useResultFacts, useResultOrder } from "./use-result-order"

export interface SearchResultsProps {
  readonly response: components["schemas"]["SearchResponse"] | undefined
  readonly pending: boolean
  readonly hotelId: string | undefined
  readonly onSelect: (result: SearchResult) => void
  readonly onProperty: (result: SearchResult, property: MatchedProperty) => void
  readonly onPreview: (result: SearchResult, property: MatchedProperty | undefined) => void
}

function uniqueResults(response: SearchResultsProps["response"]): SearchResult[] {
  return [...new Map((response?.results ?? []).map((result) => [result.hotel.id, result])).values()]
}

export function SearchResults({
  response,
  pending,
  hotelId,
  onSelect,
  onProperty,
  onPreview,
}: SearchResultsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { order, change } = useResultOrder()
  const results = uniqueResults(response)
  const details = useResultFacts(results, order)
  if (response === undefined && !pending)
    return (
      <EmptyState
        icon="building"
        title={t("explore:panel.emptyTitle")}
        description={t("explore:panel.emptyText")}
        className={styles.state}
      />
    )
  if (response === undefined)
    return (
      <div className={styles.loading} role="status" aria-label={t("common:state.loading")}>
        {["first", "second", "third"].map((key) => (
          <div key={key} className={styles.ghost}>
            <Skeleton lines={3} />
          </div>
        ))}
      </div>
    )
  if (results.length === 0) {
    const cityNeeded = !response.parsed.location_hint || Boolean(response.parsed.unsupported_region)
    return (
      <EmptyState
        icon="search"
        title={t(cityNeeded ? "explore:panel.cityTitle" : "explore:panel.noneTitle")}
        description={t(cityNeeded ? "explore:panel.cityText" : "explore:panel.noneText")}
        className={styles.state}
      />
    )
  }
  return (
    <section className={styles.results} aria-label={t("explore:panel.title")}>
      <div className={styles.count} aria-live="polite">
        <p>
          <b>{t("explore:panel.hotelCount", { count: results.length })}</b>{" "}
          {t("explore:panel.matches", { count: results.length })}
        </p>
        <SortControl
          order={order}
          keys={ORDER_KEYS.filter(
            (key) => key !== "sea" || results.some((result) => seaDistance(result) !== undefined),
          )}
          pending={details.pending}
          onChange={change}
        />
      </div>
      <StayBar />
      <div className={styles.list}>
        {orderResults(results, order, locale, details.facts).map((result, index) => (
          <HotelResult
            key={result.hotel.id}
            index={index}
            result={result}
            selected={hotelId === result.hotel.id}
            onSelect={() => onSelect(result)}
            onProperty={(property) => onProperty(result, property)}
            onPreview={(property) => onPreview(result, property)}
          />
        ))}
      </div>
    </section>
  )
}
