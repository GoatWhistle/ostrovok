import type { IconName } from "@/shared/ui"

const WEATHER_ICONS: readonly [readonly number[], IconName][] = [
  [[3], "cloud"],
  [[45, 48], "cloud-fog"],
  [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], "cloud-rain"],
  [[71, 73, 75, 77, 85, 86], "cloud-snow"],
  [[95, 96, 99], "cloud-lightning"],
]

export function weatherIcon(code: number | null | undefined, altitude: number): IconName {
  if (code === 0 || code === 1) return altitude < 0 ? "theme-dark" : "theme-light"
  if (code === 2) return altitude < 0 ? "cloud-moon" : "cloud-sun"
  return WEATHER_ICONS.find(([codes]) => codes.includes(code ?? -1))?.[1] ?? "theme-light"
}
