import type { LabelColors } from "../basemap/basemap-labels"
import { luminance, mixHex } from "../color/hex-color"
import { darkness } from "../sun/sun-light"

interface Source extends LabelColors {
  readonly land: string
  readonly horizonNight: string
}

const NIGHT_INK = 0.12
const NIGHT_HALO = 0.35
const FLIP_AT = 0.5

export function labelPalette(day: Source, tinted: Source, altitude: number): LabelColors {
  const night = darkness(altitude)
  if (night <= 0) return day
  const ink = mixHex(day.labelHalo, day.horizonNight, NIGHT_INK)
  const halo = mixHex(tinted.land, day.horizonNight, NIGHT_HALO)
  return {
    label: mixHex(day.label, ink, night),
    labelStrong: mixHex(day.labelStrong, ink, night),
    labelHalo: mixHex(day.labelHalo, halo, night),
  }
}

function lightInk(colors: LabelColors): boolean {
  return luminance(colors.label) > luminance(colors.labelHalo)
}

export function nightLabelPalette(
  day: LabelColors,
  night: LabelColors,
  altitude: number,
): LabelColors {
  const amount = darkness(altitude)
  if (amount <= 0) return day
  if (lightInk(day) !== lightInk(night)) return amount < FLIP_AT ? day : night
  return {
    label: mixHex(day.label, night.label, amount),
    labelStrong: mixHex(day.labelStrong, night.labelStrong, amount),
    labelHalo: mixHex(day.labelHalo, night.labelHalo, amount),
  }
}
