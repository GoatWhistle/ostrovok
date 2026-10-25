import { ICONS, type IconName } from "./icons"

const ALIASES: Readonly<Record<string, IconName>> = {
  sunset_view: "sunset",
  distance_to_sea: "waves",
  noise_level: "noise",
  pets_policy: "pets",
  blackout_curtains: "room",
  building_height: "building",
  double_room: "room",
}
export function characteristicIcon(key: string): IconName {
  if (key.startsWith("nearby:")) return "pin"
  if (key in ICONS) return key as IconName
  return ALIASES[key] ?? "info"
}
