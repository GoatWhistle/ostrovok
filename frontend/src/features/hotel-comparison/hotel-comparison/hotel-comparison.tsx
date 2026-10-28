import { useState } from "react"
import { useCharacteristics } from "@/entities/catalog"
import { useComparison } from "@/entities/comparison"
import { HotelStayProvider, StayBar } from "@/entities/hotel"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, ButtonLink, EmptyState, ErrorState, Skeleton } from "@/shared/ui"
import { CompareTable } from "../compare-table/compare-table"
import { comparisonView } from "../model/compare-sections"
import styles from "./hotel-comparison.module.css"

const MIN_HOTELS = 1
const PAIR = 2
const SLOT_FROM = 4
const MAX_HOTELS = 5

interface PairActionsProps {
  readonly ready: boolean
  readonly count: number
  readonly onlyDifferences: boolean
  readonly onToggle: () => void
}

function PairActions({ ready, count, onlyDifferences, onToggle }: PairActionsProps) {
  const { t } = useTranslation()
  return (
    <>
      <Button
        variant="ghost"
        size="compact"
        className={styles.toggle}
        aria-pressed={onlyDifferences}
        disabled={!ready}
        onClick={onToggle}
      >
        {t("explore:compare.onlyDifferences")}
      </Button>
      <ButtonLink
        to="/"
        variant="ghost"
        size="compact"
        icon="plus"
        className={count < SLOT_FROM ? styles.slotted : undefined}
      >
        {t("explore:compare.add")}
      </ButtonLink>
    </>
  )
}

export interface HotelComparisonProps {
  readonly ids: readonly string[]
  readonly conversationId?: string | null
  readonly onRemove: (id: string) => void
  readonly onFact: (hotelId: string, factId: string) => void
}

export function HotelComparison({ ids, conversationId, onRemove, onFact }: HotelComparisonProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const registry = useCharacteristics()
  const data = useComparison(ids, conversationId)
  const { comparison } = data
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  if (invalidSelection(ids))
    return (
      <EmptyState
        icon="compare"
        title={t("explore:compare.empty")}
        description={t("explore:compare.emptyText")}
        action={
          <ButtonLink to="/" icon="search">
            {t("explore:compare.back")}
          </ButtonLink>
        }
      />
    )
  const view = comparisonView(ids, data, registry.data?.items ?? [], locale, onlyDifferences)
  const pair = ids.length >= PAIR
  const ready = pair && !comparison.isPending && !comparison.isError
  return (
    <HotelStayProvider stay={data.stay}>
      <section className={styles.comparison}>
        <div className={styles.toolbar}>
          <p className={styles.summary} role="status">
            {ready && view.different < view.total
              ? t("explore:compare.summary", { different: view.different, total: view.total })
              : null}
          </p>
          {pair ? (
            <PairActions
              ready={ready}
              count={ids.length}
              onlyDifferences={onlyDifferences}
              onToggle={() => setOnlyDifferences((value) => !value)}
            />
          ) : null}
          <div className={styles.stay}>
            <StayBar />
          </div>
        </div>
        {comparison.isError ? (
          <ErrorState
            title={t("explore:compare.error")}
            onRetry={() => void comparison.refetch()}
            retryPending={comparison.isFetching}
          />
        ) : null}
        {registry.isError ? (
          <ErrorState
            title={t("explore:compare.registryError")}
            onRetry={() => void registry.refetch()}
          />
        ) : null}
        <CompareTable
          ids={ids}
          data={data}
          sections={view.sections}
          onRemove={onRemove}
          onFact={onFact}
        />
        {comparison.isPending && comparison.fetchStatus !== "idle" ? <Skeleton lines={6} /> : null}
        {ready && onlyDifferences && view.different === 0 ? (
          <p className={styles.same}>{t("explore:compare.emptyDifference")}</p>
        ) : null}
      </section>
    </HotelStayProvider>
  )
}

function invalidSelection(ids: readonly string[]) {
  return ids.length < MIN_HOTELS || ids.length > MAX_HOTELS
}
