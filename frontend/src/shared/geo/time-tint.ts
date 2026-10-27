import type { LightMode } from "./terrain"

const DAY_ALTITUDE = 12
const NIGHT_ALTITUDE = -8
const DUSK_STRENGTH = 0.4
const NIGHT_STRENGTH = 0.62

const TINTED = [
  "land",
  "park",
  "rock",
  "snow",
  "meadow",
  "sand",
  "water",
  "coast",
  "building",
  "buildingLine",
  "buildingVolume",
  "hotelVolume",
  "road",
  "roadCasing",
  "roadLight",
] as const

interface TintSource {
  readonly horizonDusk: string
  readonly horizonNight: string
}

function channels(hex: string): readonly number[] | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match?.[1]) return undefined
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function mixHex(from: string, to: string, amount: number): string {
  const a = channels(from)
  const b = channels(to)
  if (!a || !b || amount <= 0) return from
  return `#${a
    .map((channel, index) =>
      Math.round(channel + ((b[index] ?? channel) - channel) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

export function tintStrength(altitude: number): number {
  if (altitude >= DAY_ALTITUDE) return 0
  if (altitude <= NIGHT_ALTITUDE) return NIGHT_STRENGTH
  if (altitude >= 0) return (1 - altitude / DAY_ALTITUDE) * DUSK_STRENGTH
  const depth = altitude / NIGHT_ALTITUDE
  return DUSK_STRENGTH + (NIGHT_STRENGTH - DUSK_STRENGTH) * depth
}

export function tintForTime<
  T extends TintSource & Partial<Record<(typeof TINTED)[number], string>>,
>(colors: T, mode: LightMode, altitude?: number): T {
  const amount =
    altitude === undefined ? (mode === "day" ? 0 : DUSK_STRENGTH) : tintStrength(altitude)
  if (amount === 0) return colors
  const target = mode === "night" ? colors.horizonNight : colors.horizonDusk
  const next: Partial<Record<(typeof TINTED)[number], string>> = {}
  for (const key of TINTED) {
    const value = colors[key]
    if (value) next[key] = mixHex(value, target, amount)
  }
  return { ...colors, ...next }
}
