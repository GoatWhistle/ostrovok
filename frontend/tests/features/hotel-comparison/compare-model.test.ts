import { describe, expect, it } from "vitest"
import type { CompareCell, CompareLine } from "../../../src/features/hotel-comparison/compare-model"
import { viewLines } from "../../../src/features/hotel-comparison/compare-model"
import { wishLines } from "../../../src/features/hotel-comparison/compare-wishes"
import type { FactBrief } from "../../../src/shared/api/hotel-types"

function cell(text: string, rank?: number): CompareCell {
  return { text, glyph: { kind: "status", status: "active" }, rank }
}

function line(cells: Record<string, CompareCell>, better: CompareLine["better"]): CompareLine {
  return { key: "k", title: "K", better, cells: new Map(Object.entries(cells)) }
}

function wish(value: boolean | null, native?: number): FactBrief {
  return {
    fact_id: "f",
    characteristic_key: "derived:quiet",
    value,
    label: "quiet",
    confidence: 0.8,
    source_type: "computed",
    status: "active",
    qualifiers: {
      source_text: "quiet",
      wish_status: "matched",
      ...(native === undefined
        ? {}
        : { native_value: native, native_characteristic_key: "noise_level" }),
    },
  }
}

describe("comparison lines", () => {
  it("marks the best hotel only when values differ and a direction exists", () => {
    const ids = ["a", "b"]
    const [lower] = viewLines([line({ a: cell("5", 5), b: cell("3", 3) }, "lower")], ids, false)
    expect(lower?.best).toEqual(["b"])
    const [plain] = viewLines([line({ a: cell("5", 5), b: cell("3", 3) }, null)], ids, false)
    expect(plain?.best).toEqual([])
    const [tie] = viewLines([line({ a: cell("3", 3), b: cell("3", 3) }, "lower")], ids, false)
    expect(tie?.best).toEqual([])
  })
  it("hides identical rows and rows nobody has data for", () => {
    const ids = ["a", "b"]
    const lines = [
      line({ a: cell("x"), b: cell("x") }, null),
      line({ a: cell("x") }, null),
      line({}, null),
    ]
    expect(viewLines(lines, ids, false)).toHaveLength(2)
    expect(viewLines(lines, ids, true)).toHaveLength(1)
  })
  it("ranks wishes by match and breaks ties with the native value", () => {
    const registry = [
      { key: "noise_level", title: "Noise", compare: { group: "location", better: "lower" } },
    ]
    const rows = [
      { hotel_id: "a", cells: { "derived:quiet": wish(true, 2.5) } },
      { hotel_id: "b", cells: { "derived:quiet": wish(true, 0.4) } },
      { hotel_id: "c", cells: { "derived:quiet": wish(null) } },
    ]
    const input = { intents: [], rows, matches: new Map(), registry, locale: "en" } as const
    const [tied] = viewLines(wishLines({ ...input, ids: ["a", "b"] } as never), ["a", "b"], false)
    expect(tied?.best).toEqual(["b"])
    const [ranked] = viewLines(wishLines({ ...input, ids: ["a", "c"] } as never), ["a", "c"], false)
    expect(ranked?.best).toEqual([])
    expect(ranked?.cells.get("c")?.glyph).toEqual({ kind: "match", match: "unknown" })
  })
})
