import type { Map as MapLibreMap } from "maplibre-gl"

interface Ripple {
  readonly lng: number
  readonly lat: number
  readonly born: number
  readonly size: number
}

export interface RippleOptions {
  readonly lifeMs: number
  readonly count: number
}

const SEA_LEVEL = 1
const SPAWN_TRIES = 6
const DRIFT_PX_PER_MS = 0.006
const MIN_SIZE = 7
const SIZE_RANGE = 7
const MAX_ALPHA = 0.55
const LINE_WIDTH = 1.4

function isSea(map: MapLibreMap, x: number, y: number) {
  const point = map.unproject([x, y])
  const height = map.queryTerrainElevation(point)
  return height !== null && height <= SEA_LEVEL ? point : null
}

function drawWave(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.beginPath()
  context.moveTo(x - size, y)
  context.quadraticCurveTo(x - size / 2, y - size * 0.4, x, y)
  context.quadraticCurveTo(x + size / 2, y + size * 0.4, x + size, y)
  context.stroke()
}

export function startSeaRipples(
  map: MapLibreMap,
  canvas: HTMLCanvasElement,
  { lifeMs, count }: RippleOptions,
): () => void {
  const context = canvas.getContext("2d")
  if (!context) return () => undefined
  let ripples: Ripple[] = []
  let frame = 0
  const ratio = window.devicePixelRatio || 1
  const resize = () => {
    canvas.width = Math.round(canvas.clientWidth * ratio)
    canvas.height = Math.round(canvas.clientHeight * ratio)
  }
  const spawn = (now: number) => {
    if (!map.areTilesLoaded()) return
    for (let attempt = 0; attempt < SPAWN_TRIES && ripples.length < count; attempt += 1) {
      const point = isSea(
        map,
        Math.random() * canvas.clientWidth,
        Math.random() * canvas.clientHeight,
      )
      if (point)
        ripples.push({
          lng: point.lng,
          lat: point.lat,
          born: now,
          size: MIN_SIZE + Math.random() * SIZE_RANGE,
        })
    }
  }
  const draw = (now: number) => {
    ripples = ripples.filter((ripple) => now - ripple.born < lifeMs)
    spawn(now)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    context.strokeStyle = getComputedStyle(canvas).color
    context.lineWidth = LINE_WIDTH
    context.lineCap = "round"
    for (const ripple of ripples) {
      const age = (now - ripple.born) / lifeMs
      const { x, y } = map.project([ripple.lng, ripple.lat])
      context.globalAlpha = Math.sin(Math.PI * age) * MAX_ALPHA
      drawWave(context, x + age * lifeMs * DRIFT_PX_PER_MS, y, ripple.size)
    }
    frame = requestAnimationFrame(draw)
  }
  resize()
  map.on("resize", resize)
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    map.off("resize", resize)
    context.clearRect(0, 0, canvas.width, canvas.height)
  }
}
