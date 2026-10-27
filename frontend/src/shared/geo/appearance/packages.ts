import { NEON_TOKENS } from "./palette-tokens"
import type { AppearancePackage, MapAppearance } from "./types"

const NEON: AppearancePackage = {
  id: "neon",
  labelKey: "explore:map.neon",
  version: "1",
  palette: NEON_TOKENS,
  classPrefix: "--map-neon-class-",
  materials: { hotel: "textured", verticalGradient: true },
  effects: { windows: true, lights: true, roadGlow: true },
  mini: { terrain: false, volumes: false, lights: false },
}

export const APPEARANCES: Readonly<Record<MapAppearance, AppearancePackage>> = {
  neon: NEON,
  "toy-town": { ...NEON, id: "toy-town", labelKey: "explore:map.toyTown", version: "pending" },
}

export function isMapAppearance(value: unknown): value is MapAppearance {
  return value === "neon" || value === "toy-town"
}
