import { ICONS, type IconName } from "./icons"

const ALIASES: Readonly<Record<string, IconName>> = {
  sunset_view: "sunset",
  distance_to_sea: "waves",
  bars_nearby: "noise",
  noise_level: "noise",
  pets_policy: "pets",
  blackout_curtains: "room",
  building_height: "building",
}
export function characteristicIcon(key: string): IconName {
  if (key in ICONS) return key as IconName
  return ALIASES[key] ?? "info"
}
