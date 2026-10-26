import { describe, expect, it } from "vitest"
import { type CatalogClass, classColors } from "@/shared/geo/catalog-layers"

const item = (key: string, layer: CatalogClass["layer"], rules = 1): CatalogClass => ({
  key,
  layer,
  match: Array.from({ length: rules }, () => ({})),
  style: { fill: `--map-class-${key}` },
})

const FALLBACK = { land: "#000001", building: "#000002", road: "#000003", park: "#000004" }

describe("classColors", () => {
  it("colours known classes and falls back to the default class of the layer", () => {
    const tokens = new Map([
      ["--map-class-park", "#203d3b"],
      ["--map-class-default_ground", "#111b2d"],
      ["--map-class-road_primary", "#3a6286"],
      ["--map-class-hotel", "#76d8d0"],
    ])
    const colors = classColors(
      [
        item("park", "ground"),
        item("default_ground", "ground", 0),
        item("road_primary", "ground"),
        item("hotel", "volume"),
      ],
      (token) => tokens.get(token),
      FALLBACK,
    )
    expect(colors.ground).toEqual([
      "match",
      ["get", "class"],
      "park",
      "#203d3b",
      "default_ground",
      "#111b2d",
      "#111b2d",
    ])
    expect(colors.roads).toEqual(["match", ["get", "class"], "road_primary", "#3a6286", "#000003"])
    expect(colors.volume).toEqual(["match", ["get", "class"], "hotel", "#76d8d0", "#000002"])
  })

  it("ignores classes whose token is missing or not a colour", () => {
    const colors = classColors(
      [item("park", "ground"), item("lamp", "prop")],
      (token) => (token.endsWith("park") ? "var(--x)" : undefined),
      FALLBACK,
    )
    expect(colors).toEqual({
      ground: "#000001",
      volume: "#000002",
      roads: "#000003",
      prop: "#000004",
    })
  })
})
