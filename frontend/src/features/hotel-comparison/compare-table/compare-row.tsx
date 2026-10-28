import { MatchGlyph, StatusGlyph } from "@/entities/evidence"
import { useTranslation } from "@/shared/i18n"
import { Button, NoValue } from "@/shared/ui"
import type { CellGlyph, CompareCell, LineView } from "../model/compare-model"
import styles from "./compare-row.module.css"

export interface CompareColumn {
  readonly id: string
  readonly name: string
}

export interface CompareRowProps {
  readonly line: LineView
  readonly columns: readonly CompareColumn[]
  readonly onFact: (hotelId: string, factId: string) => void
}

function Mark({ glyph }: { readonly glyph: CellGlyph }) {
  if (glyph.kind === "match")
    return (
      <span className={styles.mark}>
        <MatchGlyph match={glyph.match} />
      </span>
    )
  if (glyph.status === "active" || glyph.status === "confirmed_by_hotelier") return null
  return (
    <span className={styles.mark}>
      <StatusGlyph status={glyph.status} />
    </span>
  )
}

function Value({ cell, best }: { readonly cell: CompareCell; readonly best: boolean }) {
  const { t } = useTranslation()
  return (
    <span className={styles.value}>
      <Mark glyph={cell.glyph} />
      <span className={styles.text} data-best={best}>
        {cell.text}
        {best ? <span className="visually-hidden">{t("explore:compare.better")}</span> : null}
      </span>
    </span>
  )
}

function Cell({
  column,
  cell,
  best,
  onFact,
}: {
  readonly column: CompareColumn
  readonly cell: CompareCell | undefined
  readonly best: boolean
  readonly onFact: CompareRowProps["onFact"]
}) {
  const owner = <span className="visually-hidden">{column.name}</span>
  const factId = cell?.factId
  return (
    <div className={styles.cell}>
      {owner}
      {!cell ? (
        <span className={styles.empty}>
          <NoValue />
        </span>
      ) : factId ? (
        <Button
          variant="ghost"
          align="start"
          className={styles.action}
          onClick={() => onFact(column.id, factId)}
        >
          <Value cell={cell} best={best} />
        </Button>
      ) : (
        <span className={styles.static}>
          <Value cell={cell} best={best} />
        </span>
      )}
    </div>
  )
}

export function CompareRow({ line, columns, onFact }: CompareRowProps) {
  return (
    <div className={styles.row} data-different={line.different} data-line={line.key}>
      <div className={styles.label}>
        <span className={styles.title} dir={line.userText ? "auto" : undefined}>
          {line.title}
        </span>
      </div>
      {columns.map((column) => (
        <Cell
          key={column.id}
          column={column}
          cell={line.cells.get(column.id)}
          best={line.best.includes(column.id)}
          onFact={onFact}
        />
      ))}
    </div>
  )
}
