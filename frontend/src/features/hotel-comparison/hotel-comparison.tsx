import { useState } from "react"
import { useCharacteristics } from "@/entities/catalog"
import { useComparison } from "@/entities/comparison"
import { characteristicTitle } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, ButtonLink, EmptyState, ErrorState, Skeleton, TextField } from "@/shared/ui"
import { CompareCards } from "./compare-cards"
import { comparisonFields } from "./compare-diff"
import styles from "./hotel-comparison.module.css"

export interface HotelComparisonProps {
  readonly ids: readonly string[]
  readonly onRemove: (id: string) => void
  readonly onFact: (hotelId: string, factId: string) => void
}

export function HotelComparison({ ids, onRemove, onFact }: HotelComparisonProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const registry = useCharacteristics()
  const data = useComparison(ids)
  const { comparison } = data
  const [filter, setFilter] = useState<boolean>()
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const fields = comparisonFields(
    comparison.data?.characteristic_keys ?? [],
    comparison.data?.rows ?? [],
    registry.data?.items ?? [],
  )
  const different = fields.filter((field) => field.different).length
  const onlyDifferences = filter ?? fields.length - different > 3
  const visible = fields.filter((field) => !onlyDifferences || field.different)
  const title = (key: string) =>
    characteristicTitle(
      key,
      locale,
      registry.data?.items?.find((item) => item.key === key)?.title ?? key,
    )
  if (ids.length < 2 || ids.length > 5)
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
  return (
    <section className={styles.comparison}>
      <div className={styles.toolbar}>
        <p className={styles.summary} role="status">
          {t("explore:compare.summary", { different, total: fields.length })}
        </p>
        <Button
          variant={onlyDifferences ? "fact" : "secondary"}
          aria-pressed={onlyDifferences}
          onClick={() => setFilter(!onlyDifferences)}
        >
          {t("explore:compare.onlyDifferences")}
        </Button>
        <fieldset className={styles.dates}>
          <legend className="visually-hidden">{t("explore:compare.priceDates")}</legend>
          <TextField
            type="date"
            label={t("explore:offers.checkIn")}
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
          />
          <TextField
            type="date"
            label={t("explore:offers.checkOut")}
            value={checkOut}
            min={checkIn}
            onChange={(event) => setCheckOut(event.target.value)}
          />
        </fieldset>
      </div>
      {comparison.isPending ? <Skeleton lines={3} /> : null}
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
      {!comparison.isPending && !comparison.isError && !visible.length ? (
        <p>{t("explore:compare.emptyDifference")}</p>
      ) : null}
      <CompareCards
        ids={ids}
        data={data}
        fields={visible}
        title={title}
        onRemove={onRemove}
        onFact={onFact}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    </section>
  )
}
