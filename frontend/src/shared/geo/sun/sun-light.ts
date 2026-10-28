import { mixHex } from "../color/hex-color"

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

export interface MoonLight {
  readonly azimuth: number
  readonly altitude: number
  readonly fraction: number
}

export interface NightLight {
  readonly moon?: MoonLight | undefined
}

export interface KeyLight {
  readonly azimuth: number
  readonly altitude: number
  readonly color: string
  readonly share: number
}

const WARM_FROM = 22
const WARM_FULL = 1
const NIGHT_FROM = -1
const NIGHT_FULL = -9
const MOON_DIM = 0.08
const MOON_FROM = 2
const MOON_MIN_SHARE = 0.4
const CITY_AZIMUTH = 20
const CITY_ALTITUDE = 12
const CITY_WARMTH = 0.3
const MIN_KEY_ALTITUDE = 5
const HIGHEST_POLAR = 26
const LOWEST_POLAR = 72
const DAY_INTENSITY = 0.72
const LOW_INTENSITY = 0.55
const NIGHT_INTENSITY = 0.38
const NIGHT_POLAR = 50
const DEGREES = Math.PI / 180

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

export function nightKey(colors: SkyColors, moon: MoonLight | undefined): KeyLight {
  if (moon && moon.altitude >= MOON_FROM)
    return {
      azimuth: moon.azimuth,
      altitude: moon.altitude,
      color: mixHex(colors.moonlight, colors.horizonNight, MOON_DIM),
      share: Math.max(MOON_MIN_SHARE, moon.fraction),
    }
  return {
    azimuth: CITY_AZIMUTH,
    altitude: CITY_ALTITUDE,
    color: mixHex(colors.moonlight, colors.sunLow, CITY_WARMTH),
    share: MOON_MIN_SHARE,
  }
}

function vector(azimuth: number, altitude: number): readonly [number, number, number] {
  const az = azimuth * DEGREES
  const alt = altitude * DEGREES
  return [Math.sin(az) * Math.cos(alt), -Math.cos(az) * Math.cos(alt), Math.sin(alt)]
}

export function keyDirection(azimuth: number, altitude: number, key: KeyLight, night: number) {
  if (night <= 0) return { azimuth, altitude }
  const from = vector(azimuth, Math.max(MIN_KEY_ALTITUDE, altitude))
  const to = vector(key.azimuth, key.altitude)
  const [x, y, z] = from.map((value, index) => value + ((to[index] ?? value) - value) * night)
  const length = Math.hypot(x ?? 0, y ?? 0, z ?? 0) || 1
  return {
    azimuth: (Math.atan2(x ?? 0, -(y ?? 0)) / DEGREES + 360) % 360,
    altitude: Math.asin((z ?? 0) / length) / DEGREES,
  }
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

function polarOf(altitude: number): number {
  return Math.min(LOWEST_POLAR, Math.max(HIGHEST_POLAR, 90 - altitude))
}

function horizonLight(colors: SkyColors, azimuth: number, altitude: number) {
  const polar = polarOf(altitude)
  return {
    color: blend(
      colors.sunlight,
      colors.sunLow,
      mixHex(colors.moonlight, colors.horizonNight, MOON_DIM),
      altitude,
    ),
    position: [1.15, azimuth, polar + (NIGHT_POLAR - polar) * darkness(altitude)] as [
      number,
      number,
      number,
    ],
  }
}

function keyedLight(colors: SkyColors, azimuth: number, altitude: number, night: NightLight) {
  const key = nightKey(colors, night.moon)
  const direction = keyDirection(azimuth, altitude, key, darkness(altitude))
  return {
    color: blend(colors.sunlight, colors.sunLow, key.color, altitude),
    position: [1.15, direction.azimuth, polarOf(direction.altitude)] as [number, number, number],
  }
}

export function sunLight(
  colors: SkyColors,
  azimuth: number,
  altitude: number,
  contrast = 1,
  night?: NightLight,
) {
  const warm = warmth(altitude)
  const day = DAY_INTENSITY + (LOW_INTENSITY - DAY_INTENSITY) * warm
  const light = night
    ? keyedLight(colors, azimuth, altitude, night)
    : horizonLight(colors, azimuth, altitude)
  return {
    color: light.color,
    intensity:
      (day + (NIGHT_INTENSITY - day) * darkness(altitude)) * (contrast + (1 - contrast) * warm),
    position: light.position,
  }
}
