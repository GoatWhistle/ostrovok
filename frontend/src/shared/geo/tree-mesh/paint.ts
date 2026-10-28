import type { Map as MapLibreMap } from "maplibre-gl"
import { lightRig, rgb } from "../roof-mesh/paint"
import { darkness, type SkyColors } from "../sun-light"
import { treeLayerOf } from "./layer"
import { LEAF_TONES } from "./scatter"

export interface TreePaint {
  readonly leaves: readonly string[]
  readonly conifer: string
  readonly trunk: string
  readonly shade: string
  readonly sky: SkyColors
  readonly azimuth: number
  readonly altitude: number
}

const SHADOW_ALPHA = 0.3
const MIN_SHADOW_ALTITUDE = 0.5
const MAX_LENGTH = 2.4

export function paintTreeMesh(map: MapLibreMap, paint: TreePaint | undefined) {
  const layer = treeLayerOf(map)
  if (!layer) return
  if (!paint || paint.leaves.length === 0) {
    layer.setLight(undefined)
    return
  }
  const rig = lightRig(paint.sky, paint.azimuth, paint.altitude)
  const [sx, sy] = rig.sun
  const flat = Math.hypot(sx, sy) || 1
  const altitude = (Math.max(MIN_SHADOW_ALTITUDE, paint.altitude) * Math.PI) / 180
  const leaves = Array.from(
    { length: LEAF_TONES },
    (_, index) => paint.leaves[index % paint.leaves.length] ?? paint.conifer,
  )
  layer.setLight({
    ...rig,
    palette: [...leaves, paint.conifer, paint.trunk].map(rgb),
    shade: rgb(paint.shade),
    shadowAlpha:
      paint.altitude < MIN_SHADOW_ALTITUDE ? 0 : SHADOW_ALPHA * (1 - darkness(paint.altitude)),
    direction: [-sx / flat, -sy / flat],
    length: Math.min(MAX_LENGTH, 0.6 / Math.tan(altitude)),
  })
}
