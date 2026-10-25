import { clsx } from "clsx"
import { useId } from "react"
import { FactStatusBadge, FactTile, hueStyle, SourceBadge } from "@/entities/evidence"
import { useFact } from "@/entities/hotel"
import { characteristicTitle, factExplanation, factLabel } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner, Button, Confidence, Disclosure, ErrorState, Skeleton } from "@/shared/ui"
import { FactCorrection } from "./fact-correction"
import styles from "./fact-details.module.css"
import { FactHistory } from "./fact-history"
import { FactProvenance } from "./fact-provenance"

export interface FactDetailsProps {
  readonly hotelId: string
  readonly factId: string
  readonly onBack: () => void
  readonly review?: boolean
  readonly className?: string | undefined
}

export function FactDetails({
  hotelId,
  factId,
  onBack,
  review = false,
  className,
}: FactDetailsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const titleId = useId()
  const query = useFact(hotelId, factId)
  const fact = query.data
  const conflicts = fact?.conflicts ?? []
  return (
    <section className={clsx(styles.detail, className)}>
      <Button
        icon="chevron-left"
        variant="ghost"
        size="compact"
        onClick={onBack}
        className={styles.back}
      >
        {t("explore:details.back")}
      </Button>
      {query.isPending ? (
        <div className={styles.skeleton} aria-hidden="true">
          <Skeleton lines={2} />
          <Skeleton shape="block" />
        </div>
      ) : null}
      {query.isError ? (
        <ErrorState
          title={t("explore:details.factError")}
          onRetry={() => void query.refetch()}
          retryPending={query.isFetching}
        />
      ) : null}
      {fact ? (
        <article
          className={styles.fact}
          style={hueStyle(fact.characteristic_key)}
          aria-labelledby={titleId}
          data-state={fact.status}
        >
          <header className={styles.head}>
            <FactTile characteristicKey={fact.characteristic_key} />
            <div className={styles.titles}>
              <p id={titleId} className={styles.title}>
                {characteristicTitle(fact.characteristic_key, locale, fact.label)}
              </p>
              {factExplanation(fact, locale) ? (
                <p className={styles.explanation}>{factExplanation(fact, locale)}</p>
              ) : null}
            </div>
          </header>
          <p className={styles.value}>{factLabel(fact, locale)}</p>
          <div className={styles.badges}>
            <SourceBadge source={fact.source_type} />
            <Confidence value={fact.confidence} />
            <FactStatusBadge status={fact.status} />
          </div>
          {conflicts.length ? (
            <Banner tone="warning" icon="alert" title={t("explore:details.conflicts")}>
              {t("explore:details.conflictsText")}
            </Banner>
          ) : null}
          {fact.provenance ? (
            <Disclosure title={t("explore:details.provenance")} icon="source" defaultOpen>
              <FactProvenance provenance={fact.provenance} conflicts={conflicts} />
            </Disclosure>
          ) : null}
          {fact.history?.length ? (
            <Disclosure title={t("explore:details.history")} icon="history">
              <FactHistory history={fact.history} />
            </Disclosure>
          ) : null}
          {review ? <FactCorrection fact={fact} /> : null}
        </article>
      ) : null}
    </section>
  )
}
