import { HotelResult } from "@/entities/hotel"
import type { MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { EmptyState, Skeleton } from "@/shared/ui"
import styles from "./search-results.module.css"
export interface SearchResultsProps {
  readonly response: components["schemas"]["SearchResponse"] | null
  readonly pending: boolean
  readonly hotelId: string | undefined
  readonly compared: readonly string[]
  readonly onSelect: (result: SearchResult) => void
  readonly onProperty: (result: SearchResult, property: MatchedProperty) => void
  readonly onCompare: (id: string) => void
  readonly onPreview: (result: SearchResult, property: MatchedProperty | undefined) => void
}
export function SearchResults({
  response,
  pending,
  hotelId,
  compared,
  onSelect,
  onProperty,
  onCompare,
  onPreview,
}: SearchResultsProps) {
  const { t } = useTranslation()
  if (response === null && !pending)
    return (
      <EmptyState
        icon="compass"
        title={t("explore:results.initial")}
        description={t("explore:results.initialText")}
      />
    )
  if (response === null)
    return (
      <div className={styles.loading}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    )
  const results = response.results
  return (
    <section className={styles.results} aria-label={t("explore:results.title")}>
      <SearchSummary first={response} count={results.length} />
      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("explore:results.empty")}
          description={
            response.parsed.needs_clarification
              ? t("explore:results.clarification")
              : t("explore:results.emptyText")
          }
        />
      ) : (
        results.map((result) => (
          <HotelResult
            key={result.hotel.id}
            result={result}
            selected={hotelId === result.hotel.id}
            compared={compared.includes(result.hotel.id)}
            onSelect={() => onSelect(result)}
            onProperty={(property) => onProperty(result, property)}
            onCompare={() => onCompare(result.hotel.id)}
            onPreview={(property) => onPreview(result, property)}
          />
        ))
      )}
    </section>
  )
}

function SearchSummary({
  first,
  count,
}: {
  first: components["schemas"]["SearchResponse"] | undefined
  count: number
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.summary} aria-live="polite">
      <p>
        {first?.parsed.intents?.length
          ? t("explore:results.count", { count })
          : t("explore:results.candidates", { count })}
      </p>
      {!first?.parsed.intents?.length ? <p>{t("explore:results.candidatesNote")}</p> : null}
      {first?.parsed.intents?.length ? (
        <div className={styles.intents}>
          {first.parsed.intents.map((intent) => (
            <span key={JSON.stringify(intent)}>
              {intent.source_text ?? intent.characteristic_key}
            </span>
          ))}
        </div>
      ) : null}
      {first?.parsed.unmatched_terms?.length ? (
        <p>
          {t("explore:results.unmatched")}: {first.parsed.unmatched_terms.join(", ")}
        </p>
      ) : null}
      {first?.parsed.corrections?.length ? (
        <div className={styles.intents} role="status">
          <strong>{t("explore:results.corrections")}</strong>
          {first.parsed.corrections.map((item) => (
            <span key={`${item.original}:${item.corrected}`}>
              {t("explore:results.correction", item)}
            </span>
          ))}
        </div>
      ) : null}
      {first?.parsed.unsupported_region ? (
        <p role="status">
          {t("explore:results.unsupportedRegion", {
            region: first.parsed.unsupported_region,
          })}
        </p>
      ) : null}
      {first?.parsed.needs_clarification ? (
        <p role="status">{t("explore:results.clarification")}</p>
      ) : null}
      {first?.pending?.length ? <p>{t("explore:results.pending")}</p> : null}
    </div>
  )
}
