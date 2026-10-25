import { ICONS, type IconName } from "./icons"

const ALIASES: Readonly<Record<string, IconName>> = {
  sunset_view: "sunset",
  distance_to_sea: "walk",
  bars_nearby: "nightlife",
  noise_level: "noise",
  pets_policy: "pets",
  blackout_curtains: "blackout",
  building_height: "height",
  double_room: "guests",
  room_capacity: "guests",
}

const HUES: Readonly<Record<string, string>> = {
  sunset_view: "var(--hue-sunset)",
  distance_to_sea: "var(--hue-walk)",
  bars_nearby: "var(--hue-nightlife)",
  noise_level: "var(--hue-quiet)",
  pets_policy: "var(--hue-pets)",
  blackout_curtains: "var(--hue-dark)",
  building_height: "var(--hue-height)",
  double_room: "var(--hue-pets)",
  room_capacity: "var(--hue-pets)",
}

export function characteristicIcon(key: string): IconName {
  if (key.startsWith("nearby:")) return "pin"
  if (key.startsWith("facility:")) return "check"
  if (key in ICONS) return key as IconName
  return ALIASES[key] ?? "info"
}

export function characteristicHue(key: string): string {
  if (key.startsWith("nearby:")) return "var(--hue-walk)"
  if (key.startsWith("facility:")) return "var(--hue-pets)"
  return HUES[key] ?? "var(--hue-sea)"
}
