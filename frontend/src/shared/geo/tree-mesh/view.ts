import type { Map as MapLibreMap } from "maplibre-gl"

interface Origin {
  readonly x: number
  readonly y: number
  readonly scale: number
}

type Matrix = ArrayLike<number>

export function localMatrix(out: Float32Array, main: Matrix, origin: Origin) {
  const { x, y, scale } = origin
  for (let row = 0; row < 4; row += 1) {
    const c0 = main[row] ?? 0
    const c1 = main[4 + row] ?? 0
    out[row] = c0 * scale
    out[4 + row] = c1 * scale
    out[8 + row] = (main[8 + row] ?? 0) * scale
    out[12 + row] = c0 * x + c1 * y + (main[12 + row] ?? 0)
  }
}

export function cameraOf(matrix: Float32Array<ArrayBuffer>): [number, number, number] {
  const point = DOMMatrix.fromFloat32Array(matrix)
    .inverse()
    .transformPoint(new DOMPoint(0, 0, -1, 1))
  const w = point.w || 1
  return [point.x / w, point.y / w, point.z / w]
}

export function focalOf(map: MapLibreMap): number {
  const fov = (map.getVerticalFieldOfView() * Math.PI) / 180
  return map.getCanvas().clientHeight / (2 * Math.tan(fov / 2))
}
