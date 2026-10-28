import { featureFilter } from "@maplibre/maplibre-gl-style-spec"
import type { LayerSpecification, Map as MapLibreMap } from "maplibre-gl"
import { describe, expect, it } from "vitest"
import {
  type BasemapAssets,
  exclusionFor,
  renderBasemapLabels,
} from "@/shared/geo/basemap/basemap-labels"

const asset = (regionId: string, maxZoom: number, bbox: readonly number[]): BasemapAssets => ({
  regionId,
  basemapUrl: `/maps/${regionId}/a.pmtiles`,
  glyphsUrl: `/maps/${regionId}/fonts/{fontstack}/{range}.pbf`,
  spriteUrl: `/maps/${regionId}/sprites/black`,
  bbox,
  maxZoom,
})

const russia = asset("russia", 14, [19.6, 41.1, 180, 82])
const sochi = asset("sochi", 15, [39.55, 43.35, 40, 43.75])

describe("exclusionFor", () => {
  it("hides coarse labels inside the bounds of a finer archive", () => {
    expect(exclusionFor(russia, [russia, sochi])).toEqual([
      "!",
      [
        "within",
        {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [39.55, 43.35],
                [40, 43.35],
                [40, 43.75],
                [39.55, 43.75],
                [39.55, 43.35],
              ],
            ],
          ],
        },
      ],
    ])
  })

  it("keeps every label of the finest archive", () => {
    expect(exclusionFor(sochi, [russia, sochi])).toBeUndefined()
  })
})

it("compiles every coarse label filter together with the local exclusion", () => {
  const collected: LayerSpecification[] = []
  const map = {
    getStyle: () => ({ layers: collected }),
    getGlyphs: () => "fonts",
    getSprite: () => ["sprite"],
    getSource: () => true,
    getLayer: (id: string) => collected.find((layer) => layer.id === id),
    addLayer: (layer: LayerSpecification) => collected.push(layer),
    setPaintProperty: () => undefined,
    moveLayer: () => undefined,
  }
  renderBasemapLabels(
    map as unknown as MapLibreMap,
    [russia, sochi],
    {
      label: "white",
      labelStrong: "white",
      labelHalo: "black",
    },
    "ru",
  )
  const filters = collected.filter((layer) => layer.type === "symbol").map((layer) => layer.filter)
  expect(filters.length).toBeGreaterThan(10)
  for (const filter of filters) expect(() => featureFilter(filter, "filter")).not.toThrow()
})
