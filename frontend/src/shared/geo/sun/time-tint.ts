import { mixHex } from "../color/hex-color"
import { darkness } from "./sun-light"

const DAY_ALTITUDE = 12
const DUSK_STRENGTH = 0.4

export const TIMED_KEYS = [
  "land",
  "park",
  "forest",
  "rock",
  "snow",
  "meadow",
  "sand",
  "water",
  "coast",
  "hillHighlight",
  "building",
  "buildingLine",
  "buildingVolume",
  "hotelVolume",
  "road",
  "roadCasing",
  "roadLight",
  "roadGlow",
] as const

export type TimedKey = (typeof TIMED_KEYS)[number]
export type NightColors = Readonly<Partial<Record<TimedKey, string>>>

interface DuskSource {
  readonly horizonDusk: string
}

export function duskStrength(altitude: number, dusk = 1): number {
  if (altitude >= DAY_ALTITUDE) return 0
  return DUSK_STRENGTH * dusk * Math.min(1, 1 - altitude / DAY_ALTITUDE)
}

export function timeHex(
  day: string,
  night: string | undefined,
  horizonDusk: string,
  altitude: number,
  dusk = 1,
): string {
  const warm = mixHex(day, horizonDusk, duskStrength(altitude, dusk))
  return night ? mixHex(warm, night, darkness(altitude)) : warm
}

export function timeColors<T extends DuskSource & Partial<Record<TimedKey, string>>>(
  day: T,
  night: NightColors,
  altitude: number,
  dusk = 1,
): T {
  if (duskStrength(altitude, dusk) === 0 && darkness(altitude) === 0) return day
  const next: Partial<Record<TimedKey, string>> = {}
  for (const key of TIMED_KEYS) {
    const value = day[key]
    if (value) next[key] = timeHex(value, night[key], day.horizonDusk, altitude, dusk)
  }
  return { ...day, ...next }
}
