import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from "three"
import { CITY, type Flat } from "./city-data"
import { token } from "./palette"

const COVER: Readonly<Record<string, readonly [string, number]>> = {
  park: ["--map-toy-green", 0.04],
  garden: ["--map-toy-green", 0.04],
  grass: ["--map-toy-green", 0.035],
  pitch: ["--map-toy-leaf-fresh", 0.05],
  cemetery: ["--map-toy-meadow", 0.03],
  farmland: ["--map-toy-meadow", 0.02],
  forest: ["--map-toy-forest", 0.045],
  wood: ["--map-toy-forest", 0.045],
  scrub: ["--map-toy-leaf-olive", 0.03],
  wetland: ["--map-toy-green", 0.03],
  beach: ["--map-toy-sand", 0.06],
  pool: ["--map-toy-water", 0.07],
  pier: ["--map-toy-paving", 0.3],
  parking: ["--map-toy-gravel", 0.05],
}

class Flats {
  positions: number[] = []
  colors: number[] = []

  polygon(flat: Flat, y: number, color: string) {
    const contour: Vector2[] = []
    for (let i = 0; i < flat.length; i += 2) contour.push(new Vector2(flat[i] ?? 0, -(flat[i + 1] ?? 0)))
    if (contour.length < 3) return
    const tone = token(color)
    let triangles: number[][]
    try {
      triangles = ShapeUtils.triangulateShape(contour, [])
    } catch {
      return
    }
    const clockwise = ShapeUtils.isClockWise(contour)
    for (const triangle of triangles) {
      const order = clockwise ? triangle : [triangle[0], triangle[2], triangle[1]]
      for (const index of order) {
        const point = contour[index ?? 0]
        if (!point) continue
        this.positions.push(point.x, y, point.y)
        this.colors.push(tone.r, tone.g, tone.b)
      }
    }
  }

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3))
    const normals = new Float32Array(this.positions.length)
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1
    geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3))
    geometry.computeBoundingSphere()
    return geometry
  }
}

export function buildGround() {
  const flats = new Flats()
  for (const land of CITY.land) flats.polygon(land, 0, "--map-toy-earth")
  for (const [kind, flat] of CITY.cover) {
    const style = COVER[kind]
    if (style) flats.polygon(flat, style[1], style[0])
  }
  for (const water of CITY.water) flats.polygon(water, 0.08, "--map-toy-water")
  return flats.geometry()
}

const WIDTH: Readonly<Record<string, readonly [number, string, number]>> = {
  road_primary: [11, "--map-toy-road-major", 0.16],
  road_secondary: [9, "--map-toy-road-major", 0.15],
  road_tertiary: [7.5, "--map-toy-road", 0.14],
  road_residential: [6, "--map-toy-road", 0.13],
  road_service: [4, "--map-toy-road-mid", 0.12],
  road_pedestrian: [4, "--map-toy-paving", 0.12],
  road_footway: [2, "--map-toy-path", 0.11],
  road_path: [1.8, "--map-toy-path", 0.11],
  road_cycleway: [2, "--map-toy-path", 0.11],
}

export function buildRoads() {
  const positions: number[] = []
  const colors: number[] = []
  for (const [kind, flat] of CITY.roads) {
    const style = WIDTH[kind]
    if (!style) continue
    const [width, color, y] = style
    const tone = token(color)
    const half = width / 2
    for (let i = 0; i + 3 < flat.length; i += 2) {
      const ax = flat[i] ?? 0
      const az = -(flat[i + 1] ?? 0)
      const bx = flat[i + 2] ?? 0
      const bz = -(flat[i + 3] ?? 0)
      const length = Math.hypot(bx - ax, bz - az)
      if (length < 0.05) continue
      const nx = (-(bz - az) / length) * half
      const nz = ((bx - ax) / length) * half
      const ex = ((bx - ax) / length) * half * 0.9
      const ez = ((bz - az) / length) * half * 0.9
      const quad = [
        [ax - nx - ex, az - nz - ez],
        [bx - nx + ex, bz - nz + ez],
        [bx + nx + ex, bz + nz + ez],
        [ax + nx - ex, az + nz - ez],
      ]
      for (const index of [0, 2, 1, 0, 3, 2]) {
        const point = quad[index] ?? [0, 0]
        positions.push(point[0] ?? 0, y, point[1] ?? 0)
        colors.push(tone.r, tone.g, tone.b)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3))
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3))
  return geometry
}

export function lampPositions(): Float32Array {
  const points: number[] = []
  for (const [kind, flat] of CITY.roads) {
    if (!["road_primary", "road_secondary", "road_tertiary", "road_pedestrian"].includes(kind)) continue
    let carry = 0
    for (let i = 0; i + 3 < flat.length; i += 2) {
      const ax = flat[i] ?? 0
      const ay = flat[i + 1] ?? 0
      const bx = flat[i + 2] ?? 0
      const by = flat[i + 3] ?? 0
      const length = Math.hypot(bx - ax, by - ay)
      let at = carry
      while (at < length) {
        const t = at / length
        points.push(ax + (bx - ax) * t, 6.5, -(ay + (by - ay) * t))
        at += 32
      }
      carry = at - length
    }
  }
  return new Float32Array(points)
}
