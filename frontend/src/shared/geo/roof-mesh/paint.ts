import type { Map as MapLibreMap } from "maplibre-gl"
import { mixHex } from "../color/hex-color"
import {
  darkness,
  keyDirection,
  type NightLight,
  nightKey,
  type SkyColors,
  sunLight,
  warmth,
} from "../sun/sun-light"
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
  readonly night?: NightLight | undefined
}

const MIN_LIGHT_ALTITUDE = 5
const DAY_LIGHT = 0.5
const LOW_LIGHT = 0.82
const HORIZON_NIGHT_LIGHT = 0.08
const KEYED_NIGHT_LIGHT = 0.18
const MOON_LIGHT = 0.1
const DAY_AMBIENT = 0.66
const LOW_AMBIENT = 0.6
const NIGHT_AMBIENT = 0.6
const SKY_SHARE = 0.3
const LOW_SKY_SHARE = 0.55

export function rgb(hex: string): Rgb {
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

export interface LightRig {
  readonly sun: Rgb
  readonly light: Rgb
  readonly ambient: Rgb
}

function keyOf(sky: SkyColors, azimuth: number, altitude: number, night?: NightLight) {
  if (!night) return { azimuth, altitude, level: HORIZON_NIGHT_LIGHT }
  const key = nightKey(sky, night.moon)
  return {
    ...keyDirection(azimuth, altitude, key, darkness(altitude)),
    level: KEYED_NIGHT_LIGHT + MOON_LIGHT * key.share,
  }
}

export function lightRig(
  sky: SkyColors,
  azimuth: number,
  altitude: number,
  night?: NightLight,
): LightRig {
  const dark = darkness(altitude)
  const warm = warmth(altitude)
  const sun = sunLight(sky, azimuth, altitude, 1, night)
  const key = keyOf(sky, azimuth, altitude, night)
  const ambient = mixHex("#ffffff", sky.sky, SKY_SHARE + (LOW_SKY_SHARE - SKY_SHARE) * warm)
  const day = DAY_LIGHT + (LOW_LIGHT - DAY_LIGHT) * warm
  const shade = DAY_AMBIENT + (LOW_AMBIENT - DAY_AMBIENT) * warm
  return {
    sun: sunVector(key.azimuth, key.altitude),
    light: scaled(rgb(sun.color), day + (key.level - day) * dark),
    ambient: scaled(rgb(ambient), shade + (NIGHT_AMBIENT - shade) * dark),
  }
}

export function roofLight(paint: RoofPaint): RoofLight {
  const cycle = (list: readonly string[], length: number) =>
    Array.from({ length }, (_, index) => list[index % Math.max(1, list.length)] ?? paint.wall)
  return {
    ...lightRig(paint.sky, paint.azimuth, paint.altitude, paint.night),
    palette: [
      ...cycle(paint.pitched, ROOF_TONES),
      paint.steel,
      paint.brick,
      ...cycle(paint.gravel, GRAVEL_TONES),
      ...cycle(paint.plaster, PLASTER_TONES),
    ].map(rgb),
  }
}

export function paintRoofMesh(map: MapLibreMap, paint: RoofPaint | undefined) {
  roofMeshOf(map)?.setLight(paint && paint.pitched.length > 0 ? roofLight(paint) : undefined)
}
