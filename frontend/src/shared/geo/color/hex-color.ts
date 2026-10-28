export type Oklab = readonly [number, number, number]

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

function linear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function encoded(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
}

export function toOklab(hex: string): Oklab | undefined {
  const rgb = channels(hex)
  if (!rgb) return undefined
  const [r = 0, g = 0, b = 0] = rgb.map((value) => linear(value / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function fromOklab([lightness, a, b]: Oklab): string {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return `#${rgb
    .map((value) =>
      Math.round(encoded(value) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

export function colorDistance(from: string, to: string): number {
  const a = toOklab(from)
  const b = toOklab(to)
  if (!a || !b) return Number.POSITIVE_INFINITY
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100
}

export function luminance(hex: string): number {
  const rgb = channels(hex)
  if (!rgb) return 0
  const [r = 0, g = 0, b = 0] = rgb.map((value) => linear(value / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
