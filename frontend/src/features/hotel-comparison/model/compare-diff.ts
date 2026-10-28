import type { Characteristic, FactBrief } from "@/shared/api/hotel-types"

export interface ComparisonRow {
  readonly hotel_id?: string
  readonly cells?: Readonly<Record<string, FactBrief>>
}

export interface ComparisonField {
  readonly key: string
  readonly group: NonNullable<Characteristic["compare"]>["group"] | "other"
  readonly different: boolean
  readonly best: readonly string[]
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`
  return JSON.stringify(value) ?? "null"
}

function normalized(fact: FactBrief | undefined) {
  if (!fact || fact.value === null || fact.value === undefined) return "missing"
  return `${fact.unit ?? ""}:${stable(fact.value)}`
}

export function differs(cells: readonly (FactBrief | undefined)[]): boolean {
  return new Set(cells.map(normalized)).size > 1
}

export function bestHotels(
  rows: readonly ComparisonRow[],
  key: string,
  better: "lower" | "higher" | null | undefined,
): readonly string[] {
  if (!better) return []
  const known = rows.flatMap((row) => {
    const fact = row.cells?.[key]
    const value = fact?.value
    if (!row.hotel_id || !fact || (typeof value !== "number" && typeof value !== "boolean"))
      return []
    if (!Number.isFinite(Number(value)) || fact.status === "computing") return []
    return [{ id: row.hotel_id, value: Number(value), unit: fact.unit ?? "" }]
  })
  if (known.length < 2 || new Set(known.map((item) => item.unit)).size > 1) return []
  const values = known.map((item) => item.value)
  if (new Set(values).size < 2) return []
  const best = better === "lower" ? Math.min(...values) : Math.max(...values)
  return known.filter((item) => item.value === best).map((item) => item.id)
}

export function comparisonFields(
  keys: readonly string[],
  rows: readonly ComparisonRow[],
  registry: readonly Characteristic[],
): ComparisonField[] {
  return keys
    .map<ComparisonField>((key) => {
      const item = registry.find((item) => item.key === key || item.key === key.split(":")[0])
      return {
        key,
        group: item?.compare?.group ?? "other",
        different: differs(rows.map((row) => row.cells?.[key])),
        best: bestHotels(rows, key, item?.compare?.better),
      }
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key))
}
