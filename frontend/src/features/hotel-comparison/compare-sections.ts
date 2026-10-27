import type { ComparisonData } from "@/entities/comparison"
import type { Characteristic } from "@/shared/api/hotel-types"
import type { Locale } from "@/shared/i18n"
import { characteristicLines } from "./compare-facts"
import { type CompareLine, type LineView, type SectionId, viewLines } from "./compare-model"
import { amenityLines, type SupplierInput, supplierFactLines } from "./compare-supplier"
import { wishLines } from "./compare-wishes"

const SECTION_ORDER: readonly SectionId[] = ["wishes", "location", "hotel", "facilities"]

export interface SectionView {
  readonly id: SectionId
  readonly lines: readonly LineView[]
}

export interface ComparisonView {
  readonly sections: readonly SectionView[]
  readonly total: number
  readonly different: number
}

export function comparisonView(
  ids: readonly string[],
  data: ComparisonData,
  registry: readonly Characteristic[],
  locale: Locale,
  onlyDifferences: boolean,
): ComparisonView {
  const rows = data.comparison.data?.rows ?? []
  const facts = characteristicLines(ids, rows, registry, locale)
  const input: SupplierInput = {
    ids,
    locale,
    supplier: (id) => data.details[ids.indexOf(id)]?.data?.details ?? undefined,
    hotel: (id) => data.hotels[ids.indexOf(id)]?.data?.hotel ?? data.matches.get(id)?.hotel,
  }
  const wishes = wishLines({
    ids,
    intents: data.intents,
    rows,
    matches: data.matches,
    registry,
    locale,
  })
  const covered = new Set(wishes.flatMap((line) => [line.key, line.covers ?? line.key]))
  const fresh = (items: readonly CompareLine[]) => items.filter((line) => !covered.has(line.key))
  const lines: Readonly<Record<SectionId, readonly CompareLine[]>> = {
    wishes,
    location: fresh(facts.location),
    hotel: fresh([...supplierFactLines(input), ...facts.hotel]),
    facilities: fresh([...facts.facilities, ...amenityLines(input)]),
  }
  const every = SECTION_ORDER.flatMap((id) => viewLines(lines[id], ids, false))
  return {
    sections: SECTION_ORDER.map((id) => ({
      id,
      lines: viewLines(lines[id], ids, onlyDifferences),
    })).filter((section) => section.lines.length > 0),
    total: every.length,
    different: every.filter((line) => line.different).length,
  }
}
