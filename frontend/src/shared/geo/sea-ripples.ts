import type { Map as MapLibreMap } from "maplibre-gl"
import { createWaveTile, WAVE_TILE } from "./wave-tile"

export interface WaveOptions {
  readonly animate: boolean
}

interface WaveLayer {
  readonly scale: number
  readonly alpha: number
  readonly vx: number
  readonly vy: number
}

interface SeaMask {
  readonly canvas: HTMLCanvasElement
  readonly anchor: { readonly x: number; readonly y: number }
  readonly view: string
}

const SEA_LEVEL = 1
const STEP = 10
const ANCHOR: [number, number] = [0, 0]
const COLOR_CHECK_MS = 1000
const LAYERS: readonly WaveLayer[] = [
  { scale: 1, alpha: 0.55, vx: 0.011, vy: 0.003 },
  { scale: 1.6, alpha: 0.35, vx: -0.006, vy: 0.005 },
]

function viewKey(map: MapLibreMap) {
  return [map.getZoom(), map.getBearing(), map.getPitch()].map((value) => value.toFixed(3)).join()
}

function buildMask(map: MapLibreMap, width: number, height: number): SeaMask | null {
  const cols = Math.ceil(width / STEP)
  const rows = Math.ceil(height / STEP)
  const canvas = document.createElement("canvas")
  canvas.width = cols
  canvas.height = rows
  const context = canvas.getContext("2d")
  if (!context || cols === 0 || rows === 0) return null
  const image = context.createImageData(cols, rows)
  let sea = 0
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < cols; col += 1) {
      const point = map.unproject([col * STEP + STEP / 2, row * STEP + STEP / 2])
      const elevation = map.queryTerrainElevation(point)
      if (elevation === null || elevation > SEA_LEVEL) continue
      image.data[(row * cols + col) * 4 + 3] = 255
      sea += 1
    }
  if (sea === 0) return null
  context.putImageData(image, 0, 0)
  return { canvas, anchor: map.project(ANCHOR), view: viewKey(map) }
}

type Point = { readonly x: number; readonly y: number }

function paintWaves(
  context: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  origin: Point,
  time: number,
  width: number,
  height: number,
) {
  context.globalCompositeOperation = "source-over"
  for (const layer of LAYERS) {
    const pattern = context.createPattern(tile, "repeat")
    if (!pattern) continue
    const size = WAVE_TILE * layer.scale
    pattern.setTransform(
      new DOMMatrix()
        .translate((origin.x + time * layer.vx) % size, (origin.y + time * layer.vy) % size)
        .scale(layer.scale),
    )
    context.globalAlpha = layer.alpha
    context.fillStyle = pattern
    context.fillRect(0, 0, width, height)
  }
}

function applyMask(context: CanvasRenderingContext2D, mask: SeaMask, origin: Point) {
  context.globalAlpha = 1
  context.globalCompositeOperation = "destination-in"
  context.imageSmoothingEnabled = true
  context.drawImage(
    mask.canvas,
    origin.x - mask.anchor.x,
    origin.y - mask.anchor.y,
    mask.canvas.width * STEP,
    mask.canvas.height * STEP,
  )
}

export function startSeaRipples(
  map: MapLibreMap,
  canvas: HTMLCanvasElement,
  { animate }: WaveOptions,
): () => void {
  const context = canvas.getContext("2d")
  if (!context) return () => undefined
  const ratio = window.devicePixelRatio || 1
  let mask: SeaMask | null = null
  let color = ""
  let tile: HTMLCanvasElement | null = null
  let checked = 0
  let frame = 0
  const resize = () => {
    canvas.width = Math.round(canvas.clientWidth * ratio)
    canvas.height = Math.round(canvas.clientHeight * ratio)
  }
  const refreshMask = () => {
    mask = map.areTilesLoaded() ? buildMask(map, canvas.clientWidth, canvas.clientHeight) : null
  }
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw)
    if (now - checked > COLOR_CHECK_MS) {
      checked = now
      const next = getComputedStyle(canvas).color
      if (next !== color || !tile) {
        color = next
        tile = createWaveTile(color)
      }
    }
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!mask || !tile || mask.view !== viewKey(map)) return
    const origin = map.project(ANCHOR)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    paintWaves(context, tile, origin, animate ? now : 0, canvas.clientWidth, canvas.clientHeight)
    applyMask(context, mask, origin)
    context.globalCompositeOperation = "source-over"
  }
  resize()
  refreshMask()
  map.on("resize", resize)
  map.on("idle", refreshMask)
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    map.off("resize", resize)
    map.off("idle", refreshMask)
    context.clearRect(0, 0, canvas.width, canvas.height)
  }
}
