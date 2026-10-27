import { type CatalogClass, classColors } from "../catalog-layers"
import { APPEARANCES } from "./packages"
import type { MapColors } from "./palette-tokens"
import type { MapAppearance } from "./types"

export function readAppearanceColors(id: MapAppearance): MapColors {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(
    Object.entries(APPEARANCES[id].palette).map(([key, token]) => [
      key,
      style.getPropertyValue(token).trim(),
    ]),
  ) as MapColors
}

export function appearanceClasses(
  id: MapAppearance,
  catalog: readonly CatalogClass[],
  colors: MapColors,
) {
  const style = getComputedStyle(document.documentElement)
  return classColors(
    catalog,
    (token) =>
      style
        .getPropertyValue(
          token.replace("--map-class-", APPEARANCES[id].classPrefix).replaceAll("_", "-"),
        )
        .trim(),
    { land: colors.land, building: colors.building, road: colors.road, park: colors.park },
  )
}
