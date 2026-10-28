import { type CatalogClass, classColors } from "../basemap/catalog-layers"
import { tintForTime, tintHex } from "../sun/horizon-tint"
import { type TimedKey, timeColors, timeHex } from "../sun/time-tint"
import { lightMode } from "../terrain/terrain"
import { gradeHex, type NightAnchor } from "./night-grade"
import { APPEARANCES } from "./packages"
import type { MapColors } from "./palette-tokens"
import type { MapAppearance, NightKey } from "./types"

export type NightPalette = Readonly<Partial<Record<NightKey, string>>>
type AnchorLayer = CatalogClass["layer"] | "road"

const CLASS_ANCHORS: Readonly<Record<AnchorLayer, readonly TimedKey[]>> = {
  ground: ["land", "park", "forest", "sand", "meadow", "rock", "water"],
  volume: ["buildingVolume", "building", "hotelVolume"],
  prop: ["forest", "park", "building", "road", "land"],
  poi: ["land", "building"],
  road: ["road", "roadCasing"],
}
const LUMINOUS_CLASSES = new Set(["lamp"])
const ROAD_PREFIX = "road_"

function readTokens(tokens: Readonly<Record<string, string>>): Record<string, string> {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(
    Object.entries(tokens).map(([key, token]) => [key, style.getPropertyValue(token).trim()]),
  )
}

export function readAppearanceColors(id: MapAppearance): MapColors {
  return readTokens(APPEARANCES[id].palette) as MapColors
}

export function readNightColors(id: MapAppearance): NightPalette {
  return Object.fromEntries(
    Object.entries(readTokens(APPEARANCES[id].night?.palette ?? {})).filter(([, value]) => value),
  )
}

export function tintedColors(
  id: MapAppearance,
  colors: MapColors,
  night: NightPalette,
  altitude: number,
): MapColors {
  const { materials, night: keyed } = APPEARANCES[id]
  return keyed
    ? timeColors(colors, night, altitude, materials.duskTint)
    : tintForTime(colors, lightMode(altitude), altitude, materials.duskTint)
}

export function nightToken(id: MapAppearance, token: string): string | undefined {
  const prefix = APPEARANCES[id].night?.prefix
  if (!prefix) return undefined
  return token.startsWith(prefix.day)
    ? `${prefix.night}${token.slice(prefix.day.length)}`
    : undefined
}

export function nightClassColor(
  hex: string,
  item: Pick<CatalogClass, "key" | "layer">,
  colors: MapColors,
  night: NightPalette,
): string | undefined {
  const layer: AnchorLayer = item.key.startsWith(ROAD_PREFIX) ? "road" : item.layer
  const anchors = CLASS_ANCHORS[layer].flatMap((key): NightAnchor[] => {
    const value = night[key]
    return value ? [{ day: colors[key], night: value }] : []
  })
  return gradeHex(hex, anchors)
}

export function appearanceClasses(
  id: MapAppearance,
  catalog: readonly CatalogClass[],
  colors: MapColors,
  nightColors: NightPalette,
  altitude?: number,
) {
  const style = getComputedStyle(document.documentElement)
  const dusk = APPEARANCES[id].materials.duskTint
  const keyed = APPEARANCES[id].night !== undefined
  const timed =
    altitude === undefined || !keyed ? colors : timeColors(colors, nightColors, altitude, dusk)
  const tint = (hex: string, item: CatalogClass) => {
    if (altitude === undefined || hex.length === 0) return hex
    if (!keyed) return tintHex(hex, colors, altitude, dusk)
    if (LUMINOUS_CLASSES.has(item.key)) return hex
    const night = nightClassColor(hex, item, colors, nightColors)
    return timeHex(hex, night, colors.horizonDusk, altitude, dusk)
  }
  return classColors(
    catalog,
    (token, item) =>
      tint(
        style
          .getPropertyValue(
            token.replace("--map-class-", APPEARANCES[id].classPrefix).replaceAll("_", "-"),
          )
          .trim(),
        item,
      ),
    { land: timed.land, building: timed.building, road: timed.road, park: timed.park },
  )
}
