import type { LightMode } from "../terrain/terrain"

const DAY_ALTITUDE = 12
const NIGHT_ALTITUDE = -8
const DUSK_STRENGTH = 0.4
const NIGHT_STRENGTH = 0.66
const NIGHT_SHARE_FROM = -1

const TINTED = [
  "land",
  "park",
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

function nightShare(altitude: number): number {
  const t = Math.min(
    1,
    Math.max(0, (NIGHT_SHARE_FROM - altitude) / (NIGHT_SHARE_FROM - NIGHT_ALTITUDE)),
  )
  return t * t * (3 - 2 * t)
}

export function tintHex(hex: string, colors: TintSource, altitude: number, dusk = 1): string {
  const amount = tintStrength(altitude, dusk)
  if (amount === 0) return hex
  return mixHex(hex, mixHex(colors.horizonDusk, colors.horizonNight, nightShare(altitude)), amount)
}

export function tintStrength(altitude: number, dusk = 1): number {
  const twilight = DUSK_STRENGTH * dusk
  if (altitude >= DAY_ALTITUDE) return 0
  if (altitude <= NIGHT_ALTITUDE) return NIGHT_STRENGTH
  if (altitude >= 0) return (1 - altitude / DAY_ALTITUDE) * twilight
  const depth = altitude / NIGHT_ALTITUDE
  return twilight + (NIGHT_STRENGTH - twilight) * depth
}

export function tintForTime<
  T extends TintSource & Partial<Record<(typeof TINTED)[number], string>>,
>(colors: T, mode: LightMode, altitude?: number, dusk = 1): T {
  const amount =
    altitude === undefined
      ? mode === "day"
        ? 0
        : DUSK_STRENGTH * dusk
      : tintStrength(altitude, dusk)
  if (amount === 0) return colors
  const night = altitude === undefined ? (mode === "night" ? 1 : 0) : nightShare(altitude)
  const target = mixHex(colors.horizonDusk, colors.horizonNight, night)
  const next: Partial<Record<(typeof TINTED)[number], string>> = {}
  for (const key of TINTED) {
    const value = colors[key]
    if (value) next[key] = mixHex(value, target, amount)
  }
  return { ...colors, ...next }
}
