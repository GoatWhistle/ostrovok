import { useEffect, useState } from "react"
import { useTheme } from "./use-theme"

const TOKENS = {
  land: "--map-land",
  park: "--map-park",
  sand: "--map-sand",
  water: "--map-water",
  building: "--map-building",
  buildingLine: "--map-building-line",
  road: "--map-road",
  roadCasing: "--map-road-casing",
  coast: "--map-coast",
  fact: "--map-fact",
  factLine: "--map-fact-line",
  route: "--map-route",
  hotelSelected: "--map-hotel-selected",
  sea: "--map-sea",
  seaDusk: "--map-sea-dusk",
  seaNight: "--map-sea-night",
  sky: "--map-sky",
  skyDusk: "--map-sky-dusk",
  skyNight: "--map-sky-night",
  horizon: "--map-horizon",
  horizonDusk: "--map-horizon-dusk",
  horizonNight: "--map-horizon-night",
  hillShadow: "--map-hill-shadow",
  hillHighlight: "--map-hill-highlight",
} as const

export type MapColors = { readonly [Key in keyof typeof TOKENS]: string }

function readColors(): MapColors {
  const style = getComputedStyle(document.documentElement)
  const entries = Object.entries(TOKENS).map(([key, token]) => [
    key,
    style.getPropertyValue(token).trim(),
  ])
  return Object.fromEntries(entries) as MapColors
}

export function useMapColors(): MapColors {
  const { theme } = useTheme()
  const [colors, setColors] = useState(readColors)
  useEffect(() => {
    if (document.documentElement.dataset.theme === theme) setColors(readColors())
  }, [theme])
  return colors
}
