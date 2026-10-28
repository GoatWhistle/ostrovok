import { describe, expect, it } from "vitest"
import { APPEARANCES } from "../../../src/shared/geo/appearance/packages"
import { nightClassColor, nightToken } from "../../../src/shared/geo/appearance/palette"
import type { MapAppearance } from "../../../src/shared/geo/appearance/types"
import { colorDistance } from "../../../src/shared/geo/color/hex-color"
import { CATALOG_LAYERS, classTokens, dayColors, nightColors, tokenHex } from "./map-tokens"

const STYLES: readonly MapAppearance[] = ["toy-town", "neon"]
const NIGHT_STYLES: readonly MapAppearance[] = ["neon"]
const DISTINCT = 6
const KEPT_SHARE = 0.6

function materialTokens(id: MapAppearance): readonly string[] {
  const { materials } = APPEARANCES[id]
  return [
    ...materials.roofTokens,
    ...materials.flatRoofTokens,
    ...materials.plasterTokens,
    materials.trimTokens.steel,
    materials.trimTokens.brick,
    ...materials.treeTokens.leaves,
    materials.treeTokens.conifer,
    materials.treeTokens.trunk,
    materials.shadowToken,
  ]
}

function anchorLayer(key: string) {
  return key.startsWith("road_") ? "road" : CATALOG_LAYERS[key]
}

describe.each(STYLES)("%s appearance package", (id) => {
  it("draws the same 3D trees and roofs as every other style", () => {
    const { effects } = APPEARANCES[id]
    expect([effects.trees, effects.roofs]).toEqual([true, true])
  })

  it("defines every palette and material token as a colour", () => {
    const { palette, night, materials } = APPEARANCES[id]
    const tokens = [
      ...Object.values(palette),
      ...Object.values(night?.palette ?? {}),
      materials.hotelRoofToken,
      ...materialTokens(id),
    ]
    for (const token of tokens) expect(tokenHex(token)).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

it("keeps the daylight map on its horizon tint after sunset", () => {
  expect(APPEARANCES["toy-town"].night).toBeUndefined()
})

describe.each(NIGHT_STYLES)("%s night palette", (id) => {
  it("gives every material its own night tone", () => {
    for (const token of materialTokens(id)) {
      const counterpart = nightToken(id, token)
      expect(counterpart).toBeDefined()
      expect(tokenHex(counterpart ?? "")).not.toBe(tokenHex(token))
    }
  })

  it("keeps distinct catalog classes apart at night", () => {
    const day = dayColors(id)
    const night = nightColors(id)
    const classes = [...classTokens(id)].flatMap(([key, hex]) => {
      const layer = anchorLayer(key)
      if (!layer || layer === "poi" || key === "lamp") return []
      const graded = nightClassColor(
        hex,
        { key, layer: CATALOG_LAYERS[key] ?? "ground" },
        day,
        night,
      )
      return graded ? [{ key, layer, hex, graded }] : []
    })
    const merged = classes.flatMap((a, index) =>
      classes.slice(index + 1).flatMap((b) => {
        const before = colorDistance(a.hex, b.hex)
        if (a.layer !== b.layer || before < DISTINCT) return []
        const after = colorDistance(a.graded, b.graded)
        return after < before * KEPT_SHARE
          ? [`${a.key}/${b.key} ${before.toFixed(1)} ${after.toFixed(1)}`]
          : []
      }),
    )
    expect(merged).toEqual([])
  })
})
