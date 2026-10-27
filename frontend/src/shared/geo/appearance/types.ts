import type { MapColors } from "./palette-tokens"

export type MapAppearance = "neon" | "toy-town"

export interface AppearancePackage {
  readonly id: MapAppearance
  readonly labelKey: "explore:map.neon" | "explore:map.toyTown"
  readonly version: string
  readonly palette: Readonly<Record<keyof MapColors, string>>
  readonly classPrefix: string
  readonly materials: {
    readonly hotel: "textured" | "matte"
    readonly verticalGradient: boolean
    readonly roofToken: string | null
    readonly roofTokens?: readonly string[]
    readonly flatRoofTokens?: readonly string[]
    readonly trimTokens?: { readonly steel: string; readonly brick: string }
    readonly shadowToken?: string
    readonly lightContrast?: number
    readonly duskTint?: number
  }
  readonly effects: {
    readonly windows: boolean
    readonly facades: boolean
    readonly roofs: boolean
    readonly lights: boolean
    readonly roadGlow: boolean
  }
  readonly mini: {
    readonly terrain: boolean
    readonly volumes: boolean
    readonly lights: boolean
  }
}

export interface AppearanceTarget {
  applyAppearance(id: MapAppearance): void
}
