import { APPEARANCES } from "./packages"
import { readAppearanceColors } from "./palette"
import type { MapAppearance } from "./types"

export interface BuildingMaterial {
  readonly mode: "textured" | "matte"
  readonly wall: readonly [number, number, number]
  readonly roof: readonly [number, number, number]
}

function channels(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

export function readBuildingMaterial(id: MapAppearance): BuildingMaterial {
  const definition = APPEARANCES[id]
  const colors = readAppearanceColors(id)
  const token = definition.materials.hotelRoofToken ?? definition.materials.roofToken
  const roof = token
    ? getComputedStyle(document.documentElement).getPropertyValue(token).trim()
    : colors.buildingVolume
  return {
    mode: definition.materials.hotel,
    wall: channels(colors.hotelVolume),
    roof: channels(roof),
  }
}
