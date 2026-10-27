import type { RoofPlan } from "./plan"
import { BRICK_TONE, type Point3, type RoofWriter, WALL_TONE } from "./writer"

export interface RoofBox {
  readonly halfLength: number
  readonly halfWidth: number
}

const OVERHANG = 0.45
const HALF_HIP = 0.38
const MANSARD_INSET = 0.22
const MANSARD_LOWER = 0.72
const CHIMNEY = 0.7

type Writer = (writer: RoofWriter, box: RoofBox, plan: RoofPlan) => void

function gableEnds(writer: RoofWriter, { halfLength: l, halfWidth: w }: RoofBox, top: number) {
  for (const u of [-l, l])
    writer.face(
      [
        [u, -w, 0],
        [u, w, 0],
        [u, 0, top],
      ],
      WALL_TONE,
    )
}

const gable: Writer = (writer, box, { rise, tone }) => {
  const L = box.halfLength + OVERHANG
  const W = box.halfWidth + OVERHANG
  for (const side of [-1, 1])
    writer.face(
      [
        [-L, side * W, 0],
        [L, side * W, 0],
        [L, 0, rise],
        [-L, 0, rise],
      ],
      tone,
    )
  gableEnds(writer, box, rise)
}

function hipped(
  writer: RoofWriter,
  box: RoofBox,
  rise: number,
  tone: number,
  ridge: number,
  from = 0,
  overhang = OVERHANG,
) {
  const L = box.halfLength + overhang
  const W = box.halfWidth + overhang
  const top = from + rise
  for (const side of [-1, 1]) {
    writer.face(
      [
        [-L, side * W, from],
        [L, side * W, from],
        [ridge, 0, top],
        [-ridge, 0, top],
      ],
      tone,
    )
    writer.face(
      [
        [side * L, -W, from],
        [side * L, W, from],
        [side * ridge, 0, top],
      ],
      tone,
    )
  }
}

const hip: Writer = (writer, box, { rise, tone }) =>
  hipped(writer, box, rise, tone, Math.max(0, box.halfLength - box.halfWidth))

const pyramid: Writer = (writer, box, { rise, tone }) => hipped(writer, box, rise, tone, 0)

const halfHip: Writer = (writer, box, { rise, tone }) => {
  const L = box.halfLength + OVERHANG
  const W = box.halfWidth + OVERHANG
  const knee = rise * (1 - HALF_HIP)
  const inner = W * HALF_HIP
  const ridge = L - inner
  for (const side of [-1, 1]) {
    writer.face(
      [
        [-L, side * W, 0],
        [L, side * W, 0],
        [L, side * inner, knee],
        [ridge, 0, rise],
        [-ridge, 0, rise],
        [-L, side * inner, knee],
      ],
      tone,
    )
    writer.face(
      [
        [side * L, -inner, knee],
        [side * L, inner, knee],
        [side * ridge, 0, rise],
      ],
      tone,
    )
    const l = box.halfLength
    const w = box.halfWidth
    writer.face(
      [
        [side * l, -w, 0],
        [side * l, w, 0],
        [side * l, inner, knee],
        [side * l, -inner, knee],
      ],
      WALL_TONE,
    )
  }
}

const shed: Writer = (writer, box, { rise, tone }) => {
  const L = box.halfLength + OVERHANG
  const W = box.halfWidth + OVERHANG
  const l = box.halfLength
  const w = box.halfWidth
  writer.face(
    [
      [-L, -W, 0],
      [L, -W, 0],
      [L, W, rise],
      [-L, W, rise],
    ],
    tone,
  )
  const high = (rise * (w + W)) / (2 * W)
  const low = (rise * (W - w)) / (2 * W)
  for (const u of [-l, l])
    writer.face(
      [
        [u, -w, 0],
        [u, w, 0],
        [u, w, high],
        [u, -w, low],
      ],
      WALL_TONE,
    )
  writer.face(
    [
      [-l, w, 0],
      [l, w, 0],
      [l, w, high],
      [-l, w, high],
    ],
    WALL_TONE,
  )
}

const mansard: Writer = (writer, box, { rise, tone }) => {
  const L = box.halfLength + OVERHANG * 0.5
  const W = box.halfWidth + OVERHANG * 0.5
  const inset = box.halfWidth * MANSARD_INSET * 2
  const knee = rise * MANSARD_LOWER
  const ring: Point3[] = [
    [-L, -W, 0],
    [L, -W, 0],
    [L, W, 0],
    [-L, W, 0],
  ]
  const upper: Point3[] = ring.map(([u, v]) => [
    u - Math.sign(u) * inset,
    v - Math.sign(v) * inset,
    knee,
  ])
  for (let index = 0; index < 4; index += 1) {
    const next = (index + 1) % 4
    const a = ring[index]
    const b = ring[next]
    const c = upper[next]
    const d = upper[index]
    if (a && b && c && d) writer.face([a, b, c, d], tone)
  }
  const top = { halfLength: L - inset, halfWidth: W - inset }
  hipped(writer, top, rise - knee, tone, Math.max(0, top.halfLength - top.halfWidth), knee, 0)
}

const WRITERS: Readonly<Record<RoofPlan["shape"], Writer>> = {
  gable,
  hip,
  pyramid,
  halfHip,
  shed,
  mansard,
}

export function writeRoof(writer: RoofWriter, box: RoofBox, plan: RoofPlan) {
  WRITERS[plan.shape](writer, box, plan)
  if (!plan.chimney) return
  const u = box.halfLength * 0.45
  const v = box.halfWidth * 0.35
  const slope = plan.rise * (1 - v / (box.halfWidth + OVERHANG))
  writer.box(u, v, CHIMNEY, slope - 0.4, plan.rise + 0.5, BRICK_TONE)
}
