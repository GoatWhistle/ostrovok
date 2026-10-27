import { mixHex } from "./time-tint"

export interface SkyColors {
  readonly sea: string
  readonly seaDusk: string
  readonly seaNight: string
  readonly sky: string
  readonly skyDusk: string
  readonly skyNight: string
  readonly horizon: string
  readonly horizonDusk: string
  readonly horizonNight: string
  readonly sunlight: string
  readonly sunLow: string
  readonly moonlight: string
}

const WARM_FROM = 22
const WARM_FULL = 1
const NIGHT_FROM = -1
const NIGHT_FULL = -9
const MOON_DIM = 0.45
const HIGHEST_POLAR = 26
const LOWEST_POLAR = 72
const NIGHT_POLAR = 50
const DAY_INTENSITY = 0.72
const LOW_INTENSITY = 0.55
const NIGHT_INTENSITY = 0.5

function smooth(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

export function warmth(altitude: number): number {
  return smooth(WARM_FROM, WARM_FULL, altitude)
}

export function darkness(altitude: number): number {
  return smooth(NIGHT_FROM, NIGHT_FULL, altitude)
}

function blend(day: string, dusk: string, night: string, altitude: number): string {
  return mixHex(mixHex(day, dusk, warmth(altitude)), night, darkness(altitude))
}

export function skyPalette(colors: SkyColors, altitude: number) {
  return {
    sea: blend(colors.sea, colors.seaDusk, colors.seaNight, altitude),
    sky: blend(colors.sky, colors.skyDusk, colors.skyNight, altitude),
    horizon: blend(colors.horizon, colors.horizonDusk, colors.horizonNight, altitude),
  }
}

export function sunLight(colors: SkyColors, azimuth: number, altitude: number) {
  const warm = warmth(altitude)
  const night = darkness(altitude)
  const moon = mixHex(colors.moonlight, colors.horizonNight, MOON_DIM)
  const polar = Math.min(LOWEST_POLAR, Math.max(HIGHEST_POLAR, 90 - altitude))
  const day = DAY_INTENSITY + (LOW_INTENSITY - DAY_INTENSITY) * warm
  return {
    color: blend(colors.sunlight, colors.sunLow, moon, altitude),
    intensity: day + (NIGHT_INTENSITY - day) * night,
    position: [1.15, azimuth, polar + (NIGHT_POLAR - polar) * night] as [number, number, number],
  }
}
