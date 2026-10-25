import { useCharacteristics } from "@/entities/catalog"
import { useComparison } from "@/entities/comparison"
import { HueIcon, StatusGlyph } from "@/entities/evidence"
import { characteristicTitle, factLabel } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  Icon,
  NoValue,
  ScrollArea,
  Skeleton,
} from "@/shared/ui"
import styles from "./hotel-comparison.module.css"

export interface HotelComparisonProps {
  readonly ids: readonly string[]
}

export function HotelComparison({ ids }: HotelComparisonProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const registry = useCharacteristics()
  const { comparison, names } = useComparison(ids)
  if (ids.length < 2 || ids.length > 5)
    return (
      <EmptyState
        icon="compare"
        title={t("explore:compare.empty")}
        description={t("explore:compare.emptyText")}
        className={styles.state}
        action={
          <ButtonLink to="/" icon="search">
            {t("explore:compare.back")}
          </ButtonLink>
        }
      />
    )
  if (comparison.isPending)
    return (
      <div className={styles.skeleton} aria-hidden="true">
        <Skeleton lines={1} />
        <Skeleton shape="block" />
        <Skeleton lines={3} />
      </div>
    )
  if (comparison.isError)
    return (
      <ErrorState
        title={t("explore:compare.error")}
        onRetry={() => void comparison.refetch()}
        retryPending={comparison.isFetching}
        className={styles.state}
      />
    )
  const rows = comparison.data.rows ?? []
  const keys = comparison.data.characteristic_keys ?? []
  const title = (key: string) => {
    const local = characteristicTitle(key, locale)
    if (local !== key) return local
    return registry.data?.items?.find((item) => item.key === key)?.title ?? key
  }
  return (
    <ScrollArea className={styles.frame}>
      <table className={styles.table}>
        <caption className="visually-hidden">{t("explore:compare.description")}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.corner}>
              {t("explore:compare.characteristic")}
            </th>
            {rows.map((row) => (
              <th scope="col" key={row.hotel_id} className={styles.hotel}>
                <span className={styles.hotelName} lang="ru">
                  <Icon name="building" size="sm" className={styles.hotelIcon} />
                  {names.get(row.hotel_id ?? "") ?? row.hotel_id}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key}>
              <th scope="row">
                <span className={styles.characteristic}>
                  <HueIcon characteristicKey={key} />
                  {title(key)}
                </span>
              </th>
              {rows.map((row) => {
                const cell = row.cells?.[key]
                return (
                  <td key={row.hotel_id}>
                    {cell ? (
                      <span className={styles.cell}>
                        <span className={styles.value}>
                          <StatusGlyph status={cell.status} />
                          {factLabel(cell, locale)}
                        </span>
                        <span className={styles.source}>
                          {t(`explore:source.${cell.source_type}`)}
                        </span>
                      </span>
                    ) : (
                      <span className={styles.value}>
                        <Icon name="unknown" size="sm" className={styles.unknown} />
                        <NoValue />
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  )
}
