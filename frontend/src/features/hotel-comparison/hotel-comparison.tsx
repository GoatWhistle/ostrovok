import { useCharacteristics } from "@/entities/catalog"
import { useComparison } from "@/entities/comparison"
import { useTranslation } from "@/shared/i18n"
import { ButtonLink, EmptyState, ErrorState, ScrollArea, Skeleton } from "@/shared/ui"
import styles from "./hotel-comparison.module.css"
export interface HotelComparisonProps {
  readonly ids: readonly string[]
}
export function HotelComparison({ ids }: HotelComparisonProps) {
  const { t } = useTranslation()
  const registry = useCharacteristics()
  const { comparison, names } = useComparison(ids)
  if (ids.length < 2 || ids.length > 5)
    return (
      <EmptyState
        icon="compare"
        title={t("explore:compare.empty")}
        description={t("explore:compare.emptyText")}
        action={
          <ButtonLink to="/" icon="back">
            {t("explore:compare.back")}
          </ButtonLink>
        }
      />
    )
  if (comparison.isPending) return <Skeleton />
  if (comparison.isError)
    return (
      <ErrorState title={t("explore:compare.error")} onRetry={() => void comparison.refetch()} />
    )
  return (
    <ScrollArea>
      <table className={styles.table}>
        <caption className="visually-hidden">{t("explore:compare.description")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("explore:compare.hotel")}</th>
            {comparison.data.characteristic_keys?.map((key) => (
              <th scope="col" key={key}>
                {registry.data?.items?.find((item) => item.key === key)?.title ?? key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.data.rows?.map((row) => (
            <tr key={row.hotel_id}>
              <th scope="row">{names.get(row.hotel_id ?? "") ?? row.hotel_id}</th>
              {comparison.data.characteristic_keys?.map((key) => (
                <td key={key}>
                  {row.cells?.[key]?.label ?? t("explore:details.unknown")}
                  {row.cells?.[key] ? (
                    <span className={styles.source}>
                      {t(`explore:status.${row.cells[key].status}`)}
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  )
}
