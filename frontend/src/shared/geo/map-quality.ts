import type { Map as MapLibreMap } from "maplibre-gl"

export type QualityLevel = 0 | 1 | 2 | 3

export const FULL_PIXEL_RATIO = 2
const REDUCED_PIXEL_RATIO = 1.5
const WINDOW_FRAMES = 120
const WINDOW_MS = 1000
const MIN_WINDOW_FRAMES = 8
const LOW_FPS = 40
const HIGH_FPS = 55
const WINDOWS_TO_DROP = 2
const WINDOWS_TO_RAISE = 4
const MAX_FRAME_MS = 250
const STALLED_FRAMES = 8
const MAX_LEVEL: QualityLevel = 3

export function windowDensity(level: QualityLevel): number {
  if (level === 0) return 1
  return level === 1 ? 0.5 : 0
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

export class QualityGovernor {
  level: QualityLevel = 0
  private frames: number[] = []
  private slow = 0
  private fast = 0
  private stalled = 0
  private elapsed = 0
  private readonly onChange: (level: QualityLevel) => void

  constructor(onChange: (level: QualityLevel) => void) {
    this.onChange = onChange
  }

  sample(frameMs: number) {
    if (!(frameMs > 0) || !Number.isFinite(frameMs)) return
    if (frameMs > MAX_FRAME_MS) {
      this.sampleStall()
      return
    }
    this.stalled = 0
    this.frames.push(frameMs)
    this.elapsed += frameMs
    const filled =
      this.frames.length >= WINDOW_FRAMES ||
      (this.elapsed >= WINDOW_MS && this.frames.length >= MIN_WINDOW_FRAMES)
    if (!filled) return
    const fps = 1000 / median(this.frames)
    this.frames = []
    this.elapsed = 0
    if (fps < LOW_FPS) {
      this.slow += 1
      this.fast = 0
      if (this.slow >= WINDOWS_TO_DROP && this.level < MAX_LEVEL) this.shift(1)
    } else if (fps > HIGH_FPS) {
      this.fast += 1
      this.slow = 0
      if (this.fast >= WINDOWS_TO_RAISE && this.level > 0) this.shift(-1)
    } else {
      this.slow = 0
      this.fast = 0
    }
  }

  private sampleStall() {
    this.stalled += 1
    if (this.stalled >= STALLED_FRAMES && this.level < MAX_LEVEL) this.shift(1)
  }

  private shift(step: 1 | -1) {
    this.frames = []
    this.elapsed = 0
    this.stalled = 0
    this.level = (this.level + step) as QualityLevel
    this.slow = 0
    this.fast = 0
    this.onChange(this.level)
  }
}

export function watchMovingFrames(map: MapLibreMap, onFrame: (frameMs: number) => void) {
  let last: number | undefined
  const reset = () => {
    last = undefined
  }
  const render = () => {
    if (!map.isMoving()) return reset()
    const now = performance.now()
    if (last !== undefined) onFrame(now - last)
    last = now
  }
  map.on("render", render)
  map.on("movestart", reset)
  return () => {
    map.off("render", render)
    map.off("movestart", reset)
  }
}

function setVisible(map: MapLibreMap, layer: string, visible: boolean) {
  if (!map.getLayer(layer)) return
  const value = visible ? "visible" : "none"
  if (map.getLayoutProperty(layer, "visibility") !== value)
    map.setLayoutProperty(layer, "visibility", value)
}

export function applyQuality(map: MapLibreMap, level: QualityLevel, roadGlow = true) {
  setVisible(map, "base-roads-glow", level === 0 && roadGlow)
  setVisible(map, "scene-volumes", level < 3)
  setVisible(map, "overview-volumes", level < 3 && map.getZoom() < 16)
  setVisible(map, "base-buildings", true)
  setVisible(map, "toy-overview-roofs", level < 3 && map.getZoom() < 16)
  setVisible(map, "toy-scene-roofs", level < 3)
  setVisible(map, "toy-context-roofs", level < 3)
  setVisible(map, "buildings-volume", level < 3)
  const ratio = Math.min(
    window.devicePixelRatio,
    level >= 2 ? REDUCED_PIXEL_RATIO : FULL_PIXEL_RATIO,
  )
  if (map.getPixelRatio() !== ratio) map.setPixelRatio(ratio)
}
