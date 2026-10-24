import { HotelResult, useHotelSearch } from "@/entities/hotel"
import type { MatchedProperty, SearchRequest, SearchResult } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Button, EmptyState, ErrorState, Skeleton } from "@/shared/ui"
import styles from "./search-results.module.css"
export interface SearchResultsProps {
  readonly request: SearchRequest | null
  readonly hotelId: string | undefined
  readonly compared: readonly string[]
  readonly onSelect: (result: SearchResult) => void
  readonly onProperty: (result: SearchResult, property: MatchedProperty) => void
  readonly onCompare: (id: string) => void
  readonly onPreview: (result: SearchResult, property: MatchedProperty | undefined) => void
}
export function SearchResults({
  request,
  hotelId,
  compared,
  onSelect,
  onProperty,
  onCompare,
  onPreview,
}: SearchResultsProps) {
  const { t } = useTranslation()
  const search = useHotelSearch(request)
  if (request === null)
    return (
      <EmptyState
        icon="compass"
        title={t("explore:results.initial")}
        description={t("explore:results.initialText")}
      />
    )
  if (search.isPending)
    return (
      <div className={styles.loading}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    )
  if (search.isError && !search.data)
    return (
      <ErrorState
        title={t("explore:results.error")}
        description={t("explore:results.errorText")}
        onRetry={() => void search.refetch()}
        retryPending={search.isFetching}
      />
    )
  const pages = search.data?.pages ?? []
  const results = [
    ...new Map(
      pages.flatMap((page) => page.results).map((result) => [result.hotel.id, result]),
    ).values(),
  ]
  const first = pages[0]
  return (
    <section className={styles.results} aria-label={t("explore:results.title")}>
      <div className={styles.summary} aria-live="polite">
        <p>{t("explore:results.count", { count: results.length })}</p>
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
        {pages.some((page) => page.pending?.length) ? <p>{t("explore:results.pending")}</p> : null}
      </div>
      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("explore:results.empty")}
          description={t("explore:results.emptyText")}
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
      {search.isFetchNextPageError ? (
        <ErrorState
          title={t("explore:results.error")}
          onRetry={() => void search.fetchNextPage()}
        />
      ) : null}
      {search.hasNextPage ? (
        <Button
          variant="secondary"
          icon="next"
          pending={search.isFetchingNextPage}
          onClick={() => void search.fetchNextPage()}
        >
          {t("explore:results.more")}
        </Button>
      ) : null}
    </section>
  )
}
