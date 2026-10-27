import type { CSSProperties } from "react"
import type { ComparisonData } from "@/entities/comparison"
import { useTranslation } from "@/shared/i18n"
import { Disclosure, ScrollArea } from "@/shared/ui"
import { CompareHead, CompareMedia } from "./compare-head"
import type { LineView, SectionId } from "./compare-model"
import { type CompareColumn, CompareRow } from "./compare-row"
import styles from "./compare-table.module.css"

export interface TableSection {
  readonly id: SectionId
  readonly lines: readonly LineView[]
}

export interface CompareTableProps {
  readonly ids: readonly string[]
  readonly data: ComparisonData
  readonly sections: readonly TableSection[]
  readonly onRemove: (id: string) => void
  readonly onFact: (hotelId: string, factId: string) => void
}

export function CompareTable({ ids, data, sections, onRemove, onFact }: CompareTableProps) {
  const { t } = useTranslation()
  const columns: CompareColumn[] = ids.map((id, index) => ({
    id,
    name: data.hotels[index]?.data?.hotel.name ?? data.details[index]?.data?.details?.name ?? id,
  }))
  return (
    <ScrollArea
      className={styles.frame}
      role="region"
      aria-label={t("explore:compare.title")}
      data-count={ids.length > 2 ? "many" : "pair"}
      tabIndex={0}
    >
      <div className={styles.table} style={{ "--compare-count": ids.length } as CSSProperties}>
        <div className={styles.photos} aria-hidden="true">
          <div className={styles.corner} />
          {ids.map((id, index) => (
            <CompareMedia
              key={id}
              hotel={data.hotels[index]?.data?.hotel ?? data.matches.get(id)?.hotel}
              supplier={data.details[index]?.data?.details ?? undefined}
            />
          ))}
        </div>
        <div className={styles.heads}>
          <div className={styles.corner} />
          {ids.map((id, index) => {
            const hotel = data.hotels[index]
            return (
              <CompareHead
                key={id}
                id={id}
                hotel={hotel?.data?.hotel ?? data.matches.get(id)?.hotel}
                supplier={data.details[index]?.data?.details ?? undefined}
                match={data.matches.get(id)}
                media={
                  <CompareMedia
                    compact
                    hotel={hotel?.data?.hotel ?? data.matches.get(id)?.hotel}
                    supplier={data.details[index]?.data?.details ?? undefined}
                  />
                }
                pending={hotel?.isPending ?? false}
                failed={hotel?.isError ?? false}
                onRetry={() => void hotel?.refetch()}
                onRemove={() => onRemove(id)}
              />
            )
          })}
        </div>
        {sections.map((section) => (
          <section key={section.id} className={styles.section} data-section={section.id}>
            <Disclosure title={t(`explore:compare.sections.${section.id}`)} defaultOpen>
              <div className={styles.rows}>
                {section.lines.map((line) => (
                  <CompareRow key={line.key} line={line} columns={columns} onFact={onFact} />
                ))}
              </div>
            </Disclosure>
          </section>
        ))}
      </div>
    </ScrollArea>
  )
}
