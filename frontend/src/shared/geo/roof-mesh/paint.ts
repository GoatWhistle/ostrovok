import type { Map as MapLibreMap } from "maplibre-gl"
import { darkness, type SkyColors, sunLight, warmth } from "../sun-light"
import { mixHex } from "../time-tint"
import { type RoofLight, roofMeshOf } from "./layer"
import { ROOF_TONES } from "./plan"
import { GRAVEL_TONES, PLASTER_TONES } from "./writer"

type Rgb = readonly [number, number, number]

export interface RoofPaint {
  readonly pitched: readonly string[]
  readonly gravel: readonly string[]
  readonly plaster: readonly string[]
  readonly steel: string
  readonly wall: string
  readonly brick: string
  readonly sky: SkyColors
  readonly azimuth: number
  readonly altitude: number
}

const MIN_LIGHT_ALTITUDE = 5
const DAY_LIGHT = 0.5
const LOW_LIGHT = 0.82
const NIGHT_LIGHT = 0.08
const DAY_AMBIENT = 0.66
const LOW_AMBIENT = 0.6
const NIGHT_AMBIENT = 0.6
const SKY_SHARE = 0.3
const LOW_SKY_SHARE = 0.55

function rgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  if (!Number.isFinite(value)) return [1, 1, 1]
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

function scaled([r, g, b]: Rgb, amount: number): Rgb {
  return [r * amount, g * amount, b * amount]
}

export function sunVector(azimuth: number, altitude: number): Rgb {
  const az = (azimuth * Math.PI) / 180
  const alt = (Math.max(MIN_LIGHT_ALTITUDE, altitude) * Math.PI) / 180
  return [Math.sin(az) * Math.cos(alt), -Math.cos(az) * Math.cos(alt), Math.sin(alt)]
}

export function roofLight(paint: RoofPaint): RoofLight {
  const night = darkness(paint.altitude)
  const warm = warmth(paint.altitude)
  const sun = sunLight(paint.sky, paint.azimuth, paint.altitude)
  const cycle = (list: readonly string[], length: number) =>
    Array.from({ length }, (_, index) => list[index % Math.max(1, list.length)] ?? paint.wall)
  const ambient = mixHex("#ffffff", paint.sky.sky, SKY_SHARE + (LOW_SKY_SHARE - SKY_SHARE) * warm)
  const day = DAY_LIGHT + (LOW_LIGHT - DAY_LIGHT) * warm
  const shade = DAY_AMBIENT + (LOW_AMBIENT - DAY_AMBIENT) * warm
  return {
    palette: [
      ...cycle(paint.pitched, ROOF_TONES),
      paint.steel,
      paint.brick,
      ...cycle(paint.gravel, GRAVEL_TONES),
      ...cycle(paint.plaster, PLASTER_TONES),
    ].map(rgb),
    sun: sunVector(paint.azimuth, paint.altitude),
    light: scaled(rgb(sun.color), day + (NIGHT_LIGHT - day) * night),
    ambient: scaled(rgb(ambient), shade + (NIGHT_AMBIENT - shade) * night),
  }
}

export function paintRoofMesh(map: MapLibreMap, paint: RoofPaint | undefined) {
  roofMeshOf(map)?.setLight(paint && paint.pitched.length > 0 ? roofLight(paint) : undefined)
}
