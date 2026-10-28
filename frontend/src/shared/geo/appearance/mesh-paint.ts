import type { Map as MapLibreMap } from "maplibre-gl"
import { paintRoofMesh } from "../roof-mesh/paint"
import type { SunPosition } from "../terrain"
import { tintHex } from "../time-tint"
import { paintTreeMesh } from "../tree-mesh/paint"
import { APPEARANCES } from "./packages"
import { readAppearanceColors } from "./palette"
import { renderAppearanceRoofs, roofPaint } from "./roofs"
import { renderGroundShadows, renderTreeShadows } from "./shadows"
import type { MapAppearance } from "./types"

export function paintMeshes(map: MapLibreMap, appearance: MapAppearance, sun: SunPosition) {
  const { materials, palette } = APPEARANCES[appearance]
  const tokens = materials.roofTokens ?? (materials.roofToken ? [materials.roofToken] : [])
  const style = getComputedStyle(document.documentElement)
  const read = (token: string) => style.getPropertyValue(token).trim()
  const sky = { horizonDusk: read(palette.horizonDusk), horizonNight: read(palette.horizonNight) }
  const tone = (token: string) => tintHex(read(token), sky, sun.altitude, materials.duskTint)
  const resolve = (list: readonly string[]) =>
    list.filter((token) => read(token).length > 0).map(tone)
  const flat = resolve(materials.flatRoofTokens ?? tokens)
  renderAppearanceRoofs(map, roofPaint(flat))
  const colors = readAppearanceColors(appearance)
  const light = { sky: colors, azimuth: sun.azimuth, altitude: sun.altitude }
  const trim = materials.trimTokens
  paintRoofMesh(
    map,
    trim && {
      ...light,
      pitched: resolve(tokens),
      gravel: flat,
      plaster: resolve(materials.plasterTokens ?? [palette.building]),
      steel: tone(trim.steel),
      brick: tone(trim.brick),
      wall: tone(palette.building),
    },
  )
  const trees = materials.treeTokens
  paintTreeMesh(
    map,
    trees && {
      ...light,
      leaves: resolve(trees.leaves),
      conifer: tone(trees.conifer),
      trunk: tone(trees.trunk),
      shade: read(materials.shadowToken ?? trees.conifer),
    },
  )
  const shadow = materials.shadowToken ? read(materials.shadowToken) : undefined
  renderGroundShadows(map, shadow, sun.azimuth, sun.altitude)
  renderTreeShadows(map, shadow, sun.azimuth, sun.altitude)
}
