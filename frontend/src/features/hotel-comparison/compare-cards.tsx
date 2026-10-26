import { type CSSProperties, Fragment } from "react"
import type { useComparison } from "@/entities/comparison"
import { useLocale, useTranslation } from "@/shared/i18n"
import { ButtonLink, Card, ScrollArea, StatusBadge } from "@/shared/ui"
import { CompareCardHead } from "./compare-card-head"
import type { ComparisonField } from "./compare-diff"
import { CompareRow } from "./compare-row"
import styles from "./hotel-comparison.module.css"

export interface CompareCardsProps {
  readonly ids: readonly string[]
  readonly data: ReturnType<typeof useComparison>
  readonly fields: readonly ComparisonField[]
  readonly title: (key: string) => string
  readonly onRemove: (id: string) => void
  readonly onFact: (hotelId: string, factId: string) => void
  readonly checkIn: string
  readonly checkOut: string
}

export function CompareCards({
  ids,
  data,
  fields,
  title,
  onRemove,
  onFact,
  checkIn,
  checkOut,
}: CompareCardsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const groups = new Set(fields.map((field) => field.group))
  const rowCount = fields.length + groups.size + 3
  return (
    <ScrollArea
      className={styles.frame}
      role="region"
      aria-label={t("explore:compare.title")}
      tabIndex={0}
    >
      <div
        className={styles.cards}
        style={{ "--compare-rows": rowCount, "--compare-count": ids.length } as CSSProperties}
      >
        {ids.map((id, index) => {
          const hotel = data.hotels[index]
          const row = data.comparison.data?.rows?.find((row) => row.hotel_id === id)
          const best = fields.filter((field) => field.best.includes(id))
          const facilities =
            locale === "ru" ? hotel?.data?.facilities_ru : hotel?.data?.facilities_en
          return (
            <Card
              as="article"
              className={styles.card}
              key={id}
              aria-label={hotel?.data?.hotel.name ?? id}
            >
              <CompareCardHead
                id={id}
                card={hotel?.data}
                match={data.matches.get(id)}
                pending={hotel?.isPending ?? false}
                failed={hotel?.isError ?? false}
                onRetry={() => void hotel?.refetch()}
                onRemove={() => onRemove(id)}
                checkIn={checkIn}
                checkOut={checkOut}
              />
              <section className={styles.strengths} aria-label={t("explore:compare.strengths")}>
                {best.length ? (
                  best.map((field) => (
                    <StatusBadge key={field.key} tone="fact" icon="check">
                      {title(field.key)}
                    </StatusBadge>
                  ))
                ) : (
                  <span>{t("explore:compare.noStrengths")}</span>
                )}
              </section>
              {fields.map((field, fieldIndex) => (
                <Fragment key={field.key}>
                  {field.group !== fields[fieldIndex - 1]?.group ? (
                    <p className={styles.group}>{t(`explore:compare.groups.${field.group}`)}</p>
                  ) : null}
                  <CompareRow
                    field={field}
                    title={title(field.key)}
                    fact={row?.cells?.[field.key]}
                    hotelId={id}
                    onFact={onFact}
                  />
                </Fragment>
              ))}
              <div className={styles.facilities}>
                <p className={styles.group}>{t("explore:compare.groups.amenities")}</p>
                {facilities?.length ? (
                  <ul>
                    {facilities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{t("explore:compare.facilitiesMissing")}</p>
                )}
              </div>
            </Card>
          )
        })}
        <div className={styles.add}>
          <ButtonLink to="/" variant="outline" icon="plus">
            {t("explore:compare.add")}
          </ButtonLink>
        </div>
      </div>
    </ScrollArea>
  )
}
