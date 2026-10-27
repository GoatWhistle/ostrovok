import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"

export type Match = MatchedProperty["match"]
export type CellGlyph =
  | { readonly kind: "match"; readonly match: Match }
  | { readonly kind: "status"; readonly status: FactBrief["status"] }
export type Better = "lower" | "higher" | null | undefined
export type SectionId = "wishes" | "location" | "hotel" | "facilities"

export interface CompareCell {
  readonly text: string
  readonly glyph: CellGlyph
  readonly factId?: string | undefined
  readonly rank?: number | undefined
}

export interface CompareLine {
  readonly key: string
  readonly title: string
  readonly userText?: boolean
  readonly better?: Better
  readonly cells: ReadonlyMap<string, CompareCell>
}

export interface CompareSection {
  readonly id: SectionId
  readonly lines: readonly CompareLine[]
}

export interface LineView extends CompareLine {
  readonly different: boolean
  readonly best: readonly string[]
}

function signature(cell: CompareCell | undefined): string {
  if (!cell) return "missing"
  const glyph = cell.glyph.kind === "match" ? cell.glyph.match : cell.glyph.status
  return `${glyph}:${cell.text}`
}

function known(cell: CompareCell | undefined): boolean {
  if (!cell) return false
  return cell.glyph.kind !== "match" || !["unknown", "computing"].includes(cell.glyph.match)
}

export function lineDiffers(line: CompareLine, ids: readonly string[]): boolean {
  return new Set(ids.map((id) => signature(line.cells.get(id)))).size > 1
}

export function lineBest(line: CompareLine, ids: readonly string[]): readonly string[] {
  if (!line.better) return []
  const known = ids.flatMap((id) => {
    const rank = line.cells.get(id)?.rank
    return rank === undefined || !Number.isFinite(rank) ? [] : [{ id, rank }]
  })
  if (known.length < 2) return []
  const values = known.map((item) => item.rank)
  if (new Set(values).size < 2) return []
  const best = line.better === "lower" ? Math.min(...values) : Math.max(...values)
  return known.filter((item) => item.rank === best).map((item) => item.id)
}

export function viewLines(
  lines: readonly CompareLine[],
  ids: readonly string[],
  onlyDifferences: boolean,
): readonly LineView[] {
  return lines
    .filter((line) => ids.some((id) => known(line.cells.get(id))))
    .map((line) => ({
      ...line,
      different: lineDiffers(line, ids),
      best: lineBest(line, ids),
    }))
    .filter((line) => !onlyDifferences || line.different)
}

export function hotelCells<T>(
  ids: readonly string[],
  pick: (id: string) => T | undefined,
  cell: (value: T, id: string) => CompareCell | undefined,
): ReadonlyMap<string, CompareCell> {
  return new Map(
    ids.flatMap((id) => {
      const value = pick(id)
      const result = value === undefined ? undefined : cell(value, id)
      return result ? [[id, result] as const] : []
    }),
  )
}
