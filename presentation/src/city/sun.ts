const LATITUDE = (43.43 * Math.PI) / 180
const DECLINATION = (23.2 * Math.PI) / 180
const SOLAR_OFFSET = 0.35

export interface SunState {
  readonly altitude: number
  readonly azimuth: number
}

export function sunAt(hour: number): SunState {
  const angle = ((hour - SOLAR_OFFSET - 12) * 15 * Math.PI) / 180
  const sinAltitude =
    Math.sin(LATITUDE) * Math.sin(DECLINATION) +
    Math.cos(LATITUDE) * Math.cos(DECLINATION) * Math.cos(angle)
  const altitude = Math.asin(sinAltitude)
  const azimuth = Math.atan2(
    Math.sin(angle),
    Math.cos(angle) * Math.sin(LATITUDE) - Math.tan(DECLINATION) * Math.cos(LATITUDE),
  )
  return { altitude: (altitude * 180) / Math.PI, azimuth: ((azimuth * 180) / Math.PI + 180) % 360 }
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
