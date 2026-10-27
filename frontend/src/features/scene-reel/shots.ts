import type { MessageKey } from "@/shared/i18n"
import walk from "./map/beach-walk.json"

export type Coordinates = readonly [number, number]
export type ProofKind = "sea" | "sunset" | "quiet"

export interface ReelCamera {
  readonly center: Coordinates
  readonly zoom: number
  readonly pitch: number
  readonly bearing: number
}

export interface Shot {
  readonly kind: ProofKind
  readonly label: MessageKey
  readonly from: ReelCamera
  readonly to: ReelCamera
}

export const HOTEL: Coordinates = [39.904065, 43.4451502]
export const SEA_MINUTES = walk.properties.estimated_minutes
export const SUNSET_AZIMUTH = 250
export const RAY_METERS = 1100
export const CONE_DEGREES = 4
export const ROUTE: readonly Coordinates[] = walk.geometry.coordinates.map(
  ([lon = 0, lat = 0]) => [lon, lat] as const,
)
export const QUIET_METERS = 150
const METERS_PER_DEGREE = 111320

const SEA: Shot = {
  kind: "sea",
  label: "explore:cover.proofs.sea",
  from: { center: [39.9035, 43.4455], zoom: 16.7, pitch: 50, bearing: -58 },
  to: { center: [39.9032, 43.4458], zoom: 17.1, pitch: 56, bearing: -34 },
}

const SUNSET: Shot = {
  kind: "sunset",
  label: "explore:cover.proofs.sunset",
  from: { center: [39.9037, 43.445], zoom: 16.5, pitch: 70, bearing: -128 },
  to: { center: [39.9034, 43.4449], zoom: 16.8, pitch: 75, bearing: -102 },
}

const QUIET: Shot = {
  kind: "quiet",
  label: "explore:cover.proofs.quiet",
  from: { center: [39.9041, 43.4452], zoom: 16.1, pitch: 42, bearing: 8 },
  to: { center: [39.9041, 43.4452], zoom: 16.4, pitch: 48, bearing: 40 },
}

export const SHOTS: readonly Shot[] = [SEA, SUNSET, QUIET]

export const STILL: ReelCamera = {
  center: [39.9024, 43.4452],
  zoom: 15.7,
  pitch: 58,
  bearing: -104,
}

export function shotAt(index: number): Shot {
  return SHOTS[((index % SHOTS.length) + SHOTS.length) % SHOTS.length] ?? SEA
}

export function offset([lon, lat]: Coordinates, azimuth: number, meters: number): Coordinates {
  const radians = (azimuth * Math.PI) / 180
  const north = (meters * Math.cos(radians)) / METERS_PER_DEGREE
  const east = (meters * Math.sin(radians)) / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180))
  return [lon + east, lat + north]
}

export function ring(center: Coordinates, meters: number, segments: number): Coordinates[] {
  return Array.from({ length: segments + 1 }, (_, step) =>
    offset(center, (step / segments) * 360, meters),
  )
}

export function along(points: readonly Coordinates[], fraction: number): Coordinates {
  const lengths = points.slice(1).map((point, step) => {
    const previous = points[step] ?? point
    return Math.hypot(point[0] - previous[0], point[1] - previous[1])
  })
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * fraction
  for (let step = 0; step < lengths.length; step += 1) {
    const length = lengths[step] ?? 0
    const start = points[step] ?? HOTEL
    const end = points[step + 1] ?? start
    if (remaining <= length && length > 0) {
      const amount = remaining / length
      return [start[0] + (end[0] - start[0]) * amount, start[1] + (end[1] - start[1]) * amount]
    }
    remaining -= length
  }
  return points[points.length - 1] ?? HOTEL
}
