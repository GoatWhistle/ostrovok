import { type ProofKind, type ReelCamera, SHOTS, STILL, shotAt } from "../shots"
import type { ReelTiming } from "./timing"

type Curve = (value: number) => number

export interface ProofState {
  readonly draw: number
  readonly label: number
  readonly opacity: number
  readonly done: boolean
}

export const span = (time: number, start: number, end: number) =>
  Math.max(0, Math.min(1, (time - start) / Math.max(1, end - start)))
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

function mixCamera(from: ReelCamera, to: ReelCamera, amount: number): ReelCamera {
  return {
    center: [mix(from.center[0], to.center[0], amount), mix(from.center[1], to.center[1], amount)],
    zoom: mix(from.zoom, to.zoom, amount),
    pitch: mix(from.pitch, to.pitch, amount),
    bearing: mix(from.bearing, to.bearing, amount),
  }
}

const COMPLETE: ProofState = { draw: 1, label: 1, opacity: 1, done: true }
const IDLE: ProofState = { draw: 0, label: 0, opacity: 0, done: false }

function proofIn(local: number, timing: ReelTiming, ease: Curve): ProofState {
  const drawStart = timing.flight - timing.fade
  const drawEnd = drawStart + timing.draw
  const labelStart = drawEnd - timing.label
  return {
    draw: ease(span(local, drawStart, drawEnd)),
    label: span(local, labelStart, labelStart + timing.label),
    opacity: 1 - ease(span(local, timing.shot - timing.fade, timing.shot)),
    done: local >= drawEnd,
  }
}

function zoomFor(camera: ReelCamera, compact: boolean): ReelCamera {
  return compact ? { ...camera, zoom: camera.zoom - 0.7 } : camera
}

export function reelFrame(
  elapsed: number,
  timing: ReelTiming,
  compact: boolean,
  ease: Curve,
  fold: Curve,
) {
  const total = timing.shot * SHOTS.length
  const time = elapsed % total
  const index = Math.min(SHOTS.length - 1, Math.floor(time / timing.shot))
  const local = time - index * timing.shot
  const shot = shotAt(index)
  const previous = elapsed < timing.shot ? shot.from : shotAt(index - 1).to
  const camera =
    local < timing.flight
      ? mixCamera(previous, shot.from, fold(local / timing.flight))
      : mixCamera(shot.from, shot.to, span(local, timing.flight, timing.shot))
  const proofs = Object.fromEntries(
    SHOTS.map((item, step) => [
      item.kind,
      step === index ? proofIn(local, timing, ease) : { ...IDLE, done: step < index },
    ]),
  ) as Record<ProofKind, ProofState>
  return {
    index,
    camera: zoomFor(camera, compact),
    proofs,
    progress: span(local, 0, timing.shot),
    pulse: (elapsed % timing.pulse) / timing.pulse,
    caret: Math.floor(elapsed / timing.caret) % 2 === 0,
  }
}

export function stillFrame(compact: boolean): ReelFrame {
  return {
    index: -1,
    camera: zoomFor(STILL, compact),
    proofs: { sea: COMPLETE, sunset: COMPLETE, quiet: COMPLETE },
    progress: 1,
    pulse: 0.5,
    caret: false,
  }
}

export type ReelFrame = ReturnType<typeof reelFrame>
