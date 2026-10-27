import type { Map as MapLibreMap } from "maplibre-gl"
import { darkness, type SkyColors, skyPalette, sunLight } from "../sun-light"
import { mixHex } from "../time-tint"
import { type RoofLight, roofMeshOf } from "./layer"
import { ROOF_TONES } from "./plan"

type Rgb = readonly [number, number, number]

export interface RoofPaint {
  readonly pitched: readonly string[]
  readonly steel: string
  readonly wall: string
  readonly brick: string
  readonly sky: SkyColors
  readonly azimuth: number
  readonly altitude: number
}

const MIN_LIGHT_ALTITUDE = 5
const DAY_LIGHT = 0.5
const NIGHT_LIGHT = 0.08
const DAY_AMBIENT = 0.66
const NIGHT_AMBIENT = 0.6
const SKY_SHARE = 0.3

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
  const sun = sunLight(paint.sky, paint.azimuth, paint.altitude)
  const tones = Array.from(
    { length: ROOF_TONES },
    (_, index) => paint.pitched[index % Math.max(1, paint.pitched.length)] ?? paint.wall,
  )
  const ambient = mixHex("#ffffff", skyPalette(paint.sky, paint.altitude).horizon, SKY_SHARE)
  return {
    palette: [...tones, paint.steel, paint.wall, paint.brick].map(rgb),
    sun: sunVector(paint.azimuth, paint.altitude),
    light: scaled(rgb(sun.color), DAY_LIGHT + (NIGHT_LIGHT - DAY_LIGHT) * night),
    ambient: scaled(rgb(ambient), DAY_AMBIENT + (NIGHT_AMBIENT - DAY_AMBIENT) * night),
  }
}

export function paintRoofMesh(map: MapLibreMap, paint: RoofPaint | undefined) {
  roofMeshOf(map)?.setLight(paint && paint.pitched.length > 0 ? roofLight(paint) : undefined)
}
