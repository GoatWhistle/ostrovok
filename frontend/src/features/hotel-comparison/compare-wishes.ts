import type {
  Characteristic,
  FactBrief,
  MatchedProperty,
  SearchResult,
} from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { wishVerdict } from "@/shared/geo/facts/wish-verdict"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"
import type { ComparisonRow } from "./compare-diff"
import type { CompareCell, CompareLine, Match } from "./compare-model"

type Intent = components["schemas"]["ParsedIntent"]

export interface WishInput {
  readonly ids: readonly string[]
  readonly intents: readonly Intent[]
  readonly rows: readonly ComparisonRow[]
  readonly matches: ReadonlyMap<string, SearchResult>
  readonly registry: readonly Characteristic[]
  readonly locale: Locale
}

const MATCH_RANK: Readonly<Record<Match, number | undefined>> = {
  full: 2,
  partial: 1,
  none: 0,
  unknown: undefined,
  computing: undefined,
}

function cellMatch(fact: FactBrief | undefined): Match {
  if (!fact) return "unknown"
  if (fact.status === "computing") return "computing"
  if (fact.value === true) return "full"
  if (fact.value === false) return "none"
  return "unknown"
}

function sourceText(fact: FactBrief | undefined): string | undefined {
  const text = fact?.qualifiers?.source_text
  return typeof text === "string" && text ? text : undefined
}

function nativeNumber(fact: FactBrief | undefined): number | undefined {
  const value = fact?.qualifiers?.native_value
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function nativeKey(fact: FactBrief | undefined): string | undefined {
  const key = fact?.qualifiers?.native_characteristic_key
  return typeof key === "string" ? key : undefined
}

function wishKeys(input: WishInput): readonly string[] {
  const own = input.intents.map((intent) => intent.characteristic_key ?? "").filter(Boolean)
  if (own.length) return [...new Set(own)]
  const derived = input.rows.flatMap((row) =>
    Object.keys(row.cells ?? {}).filter((key) => key.startsWith("derived:")),
  )
  return [...new Set(derived)].sort()
}

function wishCell(key: string, id: string, input: WishInput) {
  const property = input.matches.get(id)?.matched.find((item) => item.characteristic_key === key)
  const fact = property?.fact ?? input.rows.find((row) => row.hotel_id === id)?.cells?.[key]
  if (!property && !fact) return undefined
  const match = property?.match ?? cellMatch(fact)
  const item: MatchedProperty = {
    characteristic_key: key,
    match,
    label: property?.label ?? fact?.label ?? "",
    ...(fact ? { fact } : {}),
  }
  const text =
    wishVerdict(item, input.locale) ?? i18n.t(`explore:match.${match}`, { lng: input.locale })
  return { id, fact, match, text }
}

function refineRanks(
  cells: readonly NonNullable<ReturnType<typeof wishCell>>[],
  registry: readonly Characteristic[],
): readonly (readonly [string, CompareCell])[] {
  const ranks = cells.map((cell) => MATCH_RANK[cell.match])
  const tied = new Set(ranks).size === 1
  const natives = cells.map((cell) => nativeNumber(cell.fact))
  const direction = registry.find((item) => item.key === nativeKey(cells[0]?.fact))?.compare?.better
  const byNative = tied && direction && natives.every((value) => value !== undefined)
  return cells.map((cell, index) => {
    const native = natives[index] ?? 0
    const rank = byNative ? (direction === "lower" ? -native : native) : ranks[index]
    return [
      cell.id,
      {
        text: cell.text,
        glyph: { kind: "match", match: cell.match },
        factId: cell.fact?.fact_id,
        rank,
      },
    ] as const
  })
}

const SCRIPT: Readonly<Record<Locale, RegExp>> = {
  ru: /\p{Script=Cyrillic}/u,
  en: /^\P{Script=Cyrillic}*$/u,
}

function localTitle(candidates: readonly (string | undefined)[], locale: Locale): string {
  const present = candidates.filter((item): item is string => Boolean(item))
  return present.find((item) => SCRIPT[locale].test(item)) ?? present[0] ?? ""
}

function mergeLines(lines: readonly CompareLine[]): readonly CompareLine[] {
  const groups = new Map<string, CompareLine[]>()
  for (const line of lines) {
    const group = line.covers ?? line.key
    groups.set(group, [...(groups.get(group) ?? []), line])
  }
  return [...groups.values()].flatMap(([first, ...rest]) => {
    if (!first) return []
    const cells = new Map(first.cells)
    for (const line of rest)
      for (const [id, cell] of line.cells) if (!cells.has(id)) cells.set(id, cell)
    return [{ ...first, cells }]
  })
}

export function wishLines(input: WishInput): readonly CompareLine[] {
  const lines = wishKeys(input).map((key): CompareLine => {
    const cells = input.ids.flatMap((id) => {
      const cell = wishCell(key, id, input)
      return cell ? [cell] : []
    })
    const intent = input.intents.find((item) => item.characteristic_key === key)
    const native = cells.map((cell) => nativeKey(cell.fact)).find(Boolean) ?? key
    const title =
      intent?.source_text ??
      localTitle(
        [
          ...cells.map((cell) => sourceText(cell.fact)),
          input.registry.find((item) => item.key === native)?.title,
          cells[0]?.fact?.label,
        ],
        input.locale,
      )
    const shown = title || key
    return {
      key,
      covers: native,
      title: shown.charAt(0).toLocaleUpperCase(input.locale) + shown.slice(1),
      userText: true,
      better: "higher",
      cells: new Map(refineRanks(cells, input.registry)),
    }
  })
  return mergeLines(lines)
}
