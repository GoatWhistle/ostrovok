import { NEON } from "./neon"
import { TOY_TOWN } from "./toy-town"
import type { AppearancePackage, MapAppearance } from "./types"

export const APPEARANCES: Readonly<Record<MapAppearance, AppearancePackage>> = {
  neon: NEON,
  "toy-town": TOY_TOWN,
}

export function isMapAppearance(value: unknown): value is MapAppearance {
  return value === "neon" || value === "toy-town"
}
