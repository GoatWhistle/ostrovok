import type { LabelColors } from "../basemap/basemap-labels"
import { darkness } from "../sun/sun-light"
import { mixHex } from "../sun/time-tint"

interface Source extends LabelColors {
  readonly land: string
  readonly horizonNight: string
}

const NIGHT_INK = 0.12
const NIGHT_HALO = 0.35

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
