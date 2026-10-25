import { useEffect, useState } from "react"
import { useTheme } from "./use-theme"

function readColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    surface: style.getPropertyValue("--surface-sunken").trim(),
    building: style.getPropertyValue("--map-building").trim(),
    accent: style.getPropertyValue("--focus-ring").trim(),
    beach: style.getPropertyValue("--map-beach").trim(),
    baseBuilding: style.getPropertyValue("--map-building").trim(),
    roadCasing: style.getPropertyValue("--map-road-casing").trim(),
    road: style.getPropertyValue("--map-road").trim(),
    coast: style.getPropertyValue("--map-coast").trim(),
    highlight: style.getPropertyValue("--map-highlight").trim(),
    sea: style.getPropertyValue("--map-sea").trim(),
    seaDusk: style.getPropertyValue("--map-sea-dusk").trim(),
    seaNight: style.getPropertyValue("--map-sea-night").trim(),
    sky: style.getPropertyValue("--map-sky").trim(),
    skyDusk: style.getPropertyValue("--map-sky-dusk").trim(),
    skyNight: style.getPropertyValue("--map-sky-night").trim(),
    horizon: style.getPropertyValue("--map-horizon").trim(),
    horizonDusk: style.getPropertyValue("--map-horizon-dusk").trim(),
    horizonNight: style.getPropertyValue("--map-horizon-night").trim(),
    hillShadow: style.getPropertyValue("--map-hill-shadow").trim(),
    hillHighlight: style.getPropertyValue("--map-hill-highlight").trim(),
  }
}
export function useMapColors() {
  const { theme } = useTheme()
  const [colors, setColors] = useState(readColors)
  useEffect(() => {
    if (document.documentElement.dataset.theme === theme) setColors(readColors())
  }, [theme])
  return colors
}
