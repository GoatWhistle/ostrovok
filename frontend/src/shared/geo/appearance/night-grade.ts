import { fromOklab, type Oklab, toOklab } from "../color/hex-color"

export interface NightAnchor {
  readonly day: string
  readonly night: string
}

const LIGHTNESS_SHARE = 0.7

interface Nearest {
  readonly from: Oklab
  readonly to: Oklab
  readonly distance: number
}

function nearest(color: Oklab, anchors: readonly NightAnchor[]): Nearest | undefined {
  let best: Nearest | undefined
  for (const anchor of anchors) {
    const from = toOklab(anchor.day)
    const to = toOklab(anchor.night)
    if (!from || !to) continue
    const distance = Math.hypot(color[0] - from[0], color[1] - from[1], color[2] - from[2])
    if (!best || distance < best.distance) best = { from, to, distance }
  }
  return best
}

export function gradeHex(day: string, anchors: readonly NightAnchor[]): string | undefined {
  const color = toOklab(day)
  if (!color) return undefined
  const anchor = nearest(color, anchors)
  if (!anchor) return undefined
  const { from, to } = anchor
  return fromOklab([
    to[0] + (color[0] - from[0]) * LIGHTNESS_SHARE,
    to[1] + color[1] - from[1],
    to[2] + color[2] - from[2],
  ])
}
