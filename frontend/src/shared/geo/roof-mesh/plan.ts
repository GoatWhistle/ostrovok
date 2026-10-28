export type RoofShape = "gable" | "hip" | "pyramid" | "halfHip" | "shed" | "mansard"

export interface RoofFootprint {
  readonly id: string
  readonly length: number
  readonly width: number
  readonly area: number
}

export interface RoofPlan {
  readonly shape: RoofShape
  readonly rise: number
  readonly tone: number
  readonly chimney: boolean
}

export const ROOF_TONES = 5
const MAX_RISE = 5.2
const MIN_PITCH = 0.55
const PITCH_RANGE = 0.3
const SHED_PITCH = 0.26
const MANSARD_PITCH = 0.9
const SHED_AREA = 45
const LONG_ASPECT = 2.6
const SQUARE_ASPECT = 1.25
const MANSARD_AREA = 120
const SLATE_TONE = 3

export function seedOf(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pick(roll: number, table: readonly (readonly [RoofShape, number])[]): RoofShape {
  let edge = 0
  for (const [shape, share] of table) {
    edge += share
    if (roll < edge) return shape
  }
  return table.at(-1)?.[0] ?? "gable"
}

export function roofShape(footprint: RoofFootprint, roll: number): RoofShape {
  const aspect = footprint.length / footprint.width
  if (footprint.area < SHED_AREA)
    return pick(roll, [
      ["shed", 0.55],
      ["gable", 0.45],
    ])
  if (aspect > LONG_ASPECT)
    return pick(roll, [
      ["gable", 0.6],
      ["hip", 0.25],
      ["halfHip", 0.15],
    ])
  if (aspect < SQUARE_ASPECT)
    return pick(roll, [
      ["pyramid", 0.5],
      ["hip", 0.3],
      [footprint.area > MANSARD_AREA ? "mansard" : "gable", 0.2],
    ])
  return pick(roll, [
    ["gable", 0.42],
    ["hip", 0.3],
    ["halfHip", 0.14],
    [footprint.area > MANSARD_AREA ? "mansard" : "hip", 0.08],
    ["shed", 0.06],
  ])
}

function rise(shape: RoofShape, width: number, roll: number): number {
  if (shape === "shed") return Math.min(MAX_RISE, width * SHED_PITCH)
  if (shape === "mansard") return Math.min(MAX_RISE, width * 0.2 * MANSARD_PITCH + width * 0.12)
  return Math.min(MAX_RISE, (width / 2) * (MIN_PITCH + PITCH_RANGE * roll))
}

export function planRoof(footprint: RoofFootprint): RoofPlan {
  const seed = seedOf(footprint.id)
  const shapeRoll = (seed % 1000) / 1000
  const pitchRoll = ((seed >>> 10) % 1000) / 1000
  const shape = roofShape(footprint, shapeRoll)
  const tone = shape === "mansard" ? SLATE_TONE : (seed >>> 20) % ROOF_TONES
  return {
    shape,
    rise: rise(shape, footprint.width, pitchRoll),
    tone,
    chimney: shape !== "shed" && footprint.area > 60 && (seed >>> 5) % 3 === 0,
  }
}
