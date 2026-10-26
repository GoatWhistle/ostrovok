import type { LightMode } from "./terrain"

const STRENGTH: Readonly<Record<LightMode, number>> = { day: 0, dusk: 0.22, night: 0.55 }

const TINTED = [
  "land",
  "park",
  "rock",
  "snow",
  "meadow",
  "sand",
  "building",
  "buildingLine",
  "buildingVolume",
  "road",
  "roadCasing",
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

export function tintForTime<
  T extends TintSource & Partial<Record<(typeof TINTED)[number], string>>,
>(colors: T, mode: LightMode): T {
  const amount = STRENGTH[mode]
  if (amount === 0) return colors
  const target = mode === "night" ? colors.horizonNight : colors.horizonDusk
  const next: Partial<Record<(typeof TINTED)[number], string>> = {}
  for (const key of TINTED) {
    const value = colors[key]
    if (value) next[key] = mixHex(value, target, amount)
  }
  return { ...colors, ...next }
}
