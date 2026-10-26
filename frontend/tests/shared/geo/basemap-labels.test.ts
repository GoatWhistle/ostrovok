import { describe, expect, it } from "vitest"
import { type BasemapAssets, exclusionFor } from "@/shared/geo/basemap-labels"

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
