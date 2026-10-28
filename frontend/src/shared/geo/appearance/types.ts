import type { LabelColors } from "../basemap/basemap-labels"
import type { TimedKey } from "../sun/time-tint"
import type { MapColors } from "./palette-tokens"

export type MapAppearance = "neon" | "toy-town"
export type NightKey = TimedKey | keyof LabelColors

export interface AppearancePackage {
  readonly id: MapAppearance
  readonly labelKey: "explore:map.neon" | "explore:map.toyTown"
  readonly version: string
  readonly palette: Readonly<Record<keyof MapColors, string>>
  readonly classPrefix: string
  readonly sceneHour: number
  readonly materials: {
    readonly hotel: "textured" | "matte"
    readonly verticalGradient: boolean
    readonly hotelRoofToken: string
    readonly roofTokens: readonly string[]
    readonly flatRoofTokens: readonly string[]
    readonly trimTokens: { readonly steel: string; readonly brick: string }
    readonly plasterTokens: readonly string[]
    readonly treeTokens: {
      readonly leaves: readonly string[]
      readonly conifer: string
      readonly trunk: string
    }
    readonly shadowToken: string
    readonly lightContrast: number
    readonly duskTint: number
  }
  readonly night?: {
    readonly palette: Readonly<Record<NightKey, string>>
    readonly prefix: { readonly day: string; readonly night: string }
  }
  readonly effects: {
    readonly windows: boolean
    readonly facades: boolean
    readonly roofs: boolean
    readonly trees: boolean
    readonly lights: boolean
    readonly roadGlow: boolean
    readonly steadyLights: boolean
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
