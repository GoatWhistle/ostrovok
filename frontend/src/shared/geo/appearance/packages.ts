import { NEON_TOKENS } from "./palette-tokens"
import { TOY_TOWN } from "./toy-town"
import type { AppearancePackage, MapAppearance } from "./types"

const NEON: AppearancePackage = {
  id: "neon",
  labelKey: "explore:map.neon",
  version: "1",
  palette: NEON_TOKENS,
  classPrefix: "--map-neon-class-",
  materials: { hotel: "textured", verticalGradient: true, roofToken: null },
  effects: { windows: true, facades: false, roofs: false, lights: true, roadGlow: true },
  mini: { terrain: false, volumes: false, lights: false },
}

export const APPEARANCES: Readonly<Record<MapAppearance, AppearancePackage>> = {
  neon: NEON,
  "toy-town": TOY_TOWN,
}

export function isMapAppearance(value: unknown): value is MapAppearance {
  return value === "neon" || value === "toy-town"
}
