import { type Map as MapLibreMap, MercatorCoordinate } from "maplibre-gl"

type Rgb = readonly [number, number, number]

export interface RoofFog {
  readonly depth: readonly [number, number]
  readonly color: Rgb
  readonly horizon: Rgb
  readonly blend: readonly [number, number, number]
}

const WHITE: Rgb = [1, 1, 1]
const MAX_HORIZON_PITCH = 89.25
const DEGREE = Math.PI / 180

function hexRgb(value: unknown): Rgb {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return WHITE
  const number = Number.parseInt(value.slice(1), 16)
  return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255]
}

function amount(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback
}

function farPlane(matrix: ArrayLike<number>, center: MercatorCoordinate): number {
  const clip = (x: number, y: number) =>
    new DOMMatrix(Array.from(matrix)).transformPoint(new DOMPoint(x, y, 0, 1))
  const near = clip(center.x, center.y)
  const step = center.meterInMercatorCoordinateUnits() * 500
  const ahead = clip(center.x + step, center.y + step)
  const slope = (near.z - ahead.z) / (near.w - ahead.w || 1)
  const offset = near.z - slope * near.w
  return -offset / (slope - 1)
}

function fogDepth(map: MapLibreMap, matrix: ArrayLike<number>): [number, number] {
  const center = MercatorCoordinate.fromLngLat(map.getCenter(), 0)
  const height = map.getCanvas().clientHeight
  const toCenter = (0.5 / Math.tan((map.getVerticalFieldOfView() * DEGREE) / 2)) * height
  const pixelPerMeter = 512 * 2 ** map.getZoom() * center.meterInMercatorCoordinateUnits()
  const pitch = Math.min(map.getPitch(), MAX_HORIZON_PITCH) * DEGREE
  const near = Math.max(
    toCenter / 2,
    toCenter + (map.getCenterElevation() * pixelPerMeter) / Math.cos(pitch),
  )
  const far = farPlane(matrix, center)
  return [(far + near) / (far - near), (2 * far * near) / (far - near)]
}

export function roofFog(map: MapLibreMap, matrix: ArrayLike<number>): RoofFog {
  const sky = map.getSky()
  const active = sky !== undefined && map.getTerrain() !== null
  return {
    depth: fogDepth(map, matrix),
    color: hexRgb(sky?.["fog-color"]),
    horizon: hexRgb(sky?.["horizon-color"]),
    blend: [
      amount(sky?.["fog-ground-blend"], 1),
      amount(sky?.["horizon-fog-blend"], 1),
      active ? Math.min(1, Math.max(0, (map.getPitch() - 60) / 10)) : 0,
    ],
  }
}
