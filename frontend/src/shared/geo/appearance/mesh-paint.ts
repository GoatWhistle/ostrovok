import type { Map as MapLibreMap } from "maplibre-gl"
import { paintRoofMesh } from "../roof-mesh/paint"
import { tintHex } from "../sun/horizon-tint"
import { timeHex } from "../sun/time-tint"
import type { SunPosition } from "../terrain/terrain"
import { paintTreeMesh } from "../tree-mesh/paint"
import { APPEARANCES } from "./packages"
import { nightToken, readAppearanceColors } from "./palette"
import { renderAppearanceRoofs, roofPaint } from "./roofs"
import { renderGroundShadows, renderTreeShadows } from "./shadows"
import type { MapAppearance } from "./types"

export function paintMeshes(
  map: MapLibreMap,
  appearance: MapAppearance,
  sun: SunPosition,
  tint = sun.altitude,
) {
  const { materials, palette, night: keyed } = APPEARANCES[appearance]
  const style = getComputedStyle(document.documentElement)
  const read = (token: string) => style.getPropertyValue(token).trim()
  const sky = { horizonDusk: read(palette.horizonDusk), horizonNight: read(palette.horizonNight) }
  const tone = (token: string) => {
    if (!keyed) return tintHex(read(token), sky, tint, materials.duskTint)
    const night = nightToken(appearance, token)
    const value = night ? read(night) : ""
    return timeHex(read(token), value || undefined, sky.horizonDusk, tint, materials.duskTint)
  }
  const resolve = (list: readonly string[]) =>
    list.filter((token) => read(token).length > 0).map(tone)
  const flat = resolve(materials.flatRoofTokens)
  const trim = materials.trimTokens
  const hotel = keyed ? read(palette.hotelSelected) : tone(palette.hotelSelected)
  renderAppearanceRoofs(map, roofPaint(flat), hotel)
  const colors = readAppearanceColors(appearance)
  const light = {
    sky: colors,
    azimuth: sun.azimuth,
    altitude: sun.altitude,
    night: keyed ? { moon: sun.moon } : undefined,
  }
  paintRoofMesh(map, {
    ...light,
    pitched: resolve(materials.roofTokens),
    gravel: flat,
    plaster: resolve(materials.plasterTokens),
    steel: tone(trim.steel),
    brick: tone(trim.brick),
    wall: tone(palette.building),
  })
  const trees = materials.treeTokens
  paintTreeMesh(map, {
    ...light,
    leaves: resolve(trees.leaves),
    conifer: tone(trees.conifer),
    trunk: tone(trees.trunk),
    shade: read(materials.shadowToken),
  })
  const shadow = read(materials.shadowToken)
  renderGroundShadows(map, shadow || undefined, sun.azimuth, sun.altitude)
  renderTreeShadows(map, shadow || undefined, sun.azimuth, sun.altitude)
}
