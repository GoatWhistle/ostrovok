import { useMemo } from "react"
import { readAppearanceColors } from "../geo/appearance/palette"
import type { MapAppearance } from "../geo/appearance/types"
import { useMapAppearance } from "./map-appearance"

export type { MapColors } from "../geo/appearance/palette-tokens"

export function readTokenColors(tokens: readonly string[]): ReadonlyMap<string, string> {
  const style = getComputedStyle(document.documentElement)
  return new Map(tokens.map((token) => [token, style.getPropertyValue(token).trim()]))
}

export function useMapColors(override?: MapAppearance) {
  const appearance = useMapAppearance()
  const id = override ?? appearance.id
  return useMemo(() => readAppearanceColors(id), [id])
}
