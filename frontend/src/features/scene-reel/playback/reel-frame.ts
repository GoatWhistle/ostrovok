import { type ProofKind, type ReelCamera, SHOTS, STILL } from "../shots"
import type { ReelTiming } from "./timing"

type Curve = (value: number) => number

export interface ProofState {
  readonly draw: number
  readonly label: number
  readonly opacity: number
  readonly done: boolean
}

interface Key {
  readonly at: number
  readonly values: readonly number[]
}

export const span = (time: number, start: number, end: number) =>
  Math.max(0, Math.min(1, (time - start) / Math.max(1, end - start)))

const COMPLETE: ProofState = { draw: 1, label: 1, opacity: 1, done: true }
const IDLE: ProofState = { draw: 0, label: 0, opacity: 0, done: false }

function valuesOf(camera: ReelCamera): number[] {
  return [camera.center[0], camera.center[1], camera.zoom, camera.pitch, camera.bearing]
}

function keysOf(timing: ReelTiming): Key[] {
  return SHOTS.flatMap((shot, index) => [
    { at: index * timing.shot + timing.flight, values: valuesOf(shot.from) },
    { at: (index + 1) * timing.shot, values: valuesOf(shot.to) },
  ])
}

function keyAt(keys: readonly Key[], index: number, total: number): Key {
  const count = keys.length
  const wrapped = ((index % count) + count) % count
  const key = keys[wrapped] ?? { at: 0, values: [] }
  return { at: key.at + Math.floor(index / count) * total, values: key.values }
}

function slope(before: Key, after: Key, component: number): number {
  return ((after.values[component] ?? 0) - (before.values[component] ?? 0)) / (after.at - before.at)
}

function hermite(keys: readonly Key[], time: number, total: number): number[] {
  let index = keys.findIndex((key) => key.at > time) - 1
  if (index < -1) index = keys.length - 1
  const start = keyAt(keys, index, total)
  const end = keyAt(keys, index + 1, total)
  const before = keyAt(keys, index - 1, total)
  const after = keyAt(keys, index + 2, total)
  const length = end.at - start.at
  const t = (time - start.at) / length
  const t2 = t * t
  const t3 = t2 * t
  return start.values.map((value, component) => {
    const target = end.values[component] ?? value
    const m0 = slope(before, end, component) * length
    const m1 = slope(start, after, component) * length
    return (
      (2 * t3 - 3 * t2 + 1) * value +
      (t3 - 2 * t2 + t) * m0 +
      (-2 * t3 + 3 * t2) * target +
      (t3 - t2) * m1
    )
  })
}

function cameraAt(timing: ReelTiming, time: number): ReelCamera {
  const total = timing.shot * SHOTS.length
  const [lon = 0, lat = 0, zoom = 0, pitch = 0, bearing = 0] = hermite(keysOf(timing), time, total)
  return { center: [lon, lat], zoom, pitch, bearing }
}

function proofIn(local: number, timing: ReelTiming, ease: Curve): ProofState {
  const drawStart = timing.flight - timing.fade
  const drawEnd = drawStart + timing.draw
  return {
    draw: ease(span(local, drawStart, drawEnd)),
    label: ease(span(local, drawEnd, drawEnd + timing.label)),
    opacity: 1 - ease(span(local, timing.shot - timing.fade, timing.shot)),
    done: local >= drawEnd,
  }
}

function zoomFor(camera: ReelCamera, compact: boolean): ReelCamera {
  return compact ? { ...camera, zoom: camera.zoom - 0.7 } : camera
}

export function reelFrame(elapsed: number, timing: ReelTiming, compact: boolean, ease: Curve) {
  const total = timing.shot * SHOTS.length
  const time = elapsed % total
  const index = Math.min(SHOTS.length - 1, Math.floor(time / timing.shot))
  const local = time - index * timing.shot
  const proofs = Object.fromEntries(
    SHOTS.map((item, step) => [
      item.kind,
      step === index ? proofIn(local, timing, ease) : { ...IDLE, done: step < index },
    ]),
  ) as Record<ProofKind, ProofState>
  return {
    index,
    camera: zoomFor(cameraAt(timing, time), compact),
    proofs,
    progress: span(local, 0, timing.shot),
    pulse: (elapsed % timing.pulse) / timing.pulse,
  }
}

export function stillFrame(compact: boolean): ReelFrame {
  return {
    index: -1,
    camera: zoomFor(STILL, compact),
    proofs: { sea: COMPLETE, sunset: COMPLETE, quiet: COMPLETE },
    progress: 1,
    pulse: 0.5,
  }
}

export type ReelFrame = ReturnType<typeof reelFrame>
