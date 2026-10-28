import type { Map as MapLibreMap } from "maplibre-gl"

export const LAMP_ICON = "night-lamp"
export const LAMP_POST_ICON = "night-lamp-post"
const POOL = 64
const POST_WIDTH = 12
const POST_HEIGHT = 40
const HEAD = 4

function poolPixels(): Uint8Array {
  const data = new Uint8Array(POOL * POOL * 4)
  const middle = (POOL - 1) / 2
  for (let y = 0; y < POOL; y += 1)
    for (let x = 0; x < POOL; x += 1) {
      const distance = Math.min(1, Math.hypot(x - middle, y - middle) / middle)
      const at = (y * POOL + x) * 4
      data[at] = 255
      data[at + 1] = 255
      data[at + 2] = 255
      data[at + 3] = Math.round(255 * Math.exp(-4.5 * distance * distance) * (1 - distance))
    }
  return data
}

function hexRgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16)
  if (!Number.isFinite(value)) return [255, 214, 140]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function postPixel(x: number, y: number, light: readonly [number, number, number]): number[] {
  const middle = (POST_WIDTH - 1) / 2
  const head = Math.hypot(x - middle, y - HEAD) / HEAD
  if (head <= 1) {
    const core = Math.max(0, 1 - head)
    return [...light.map((part) => Math.round(part + (255 - part) * core * 0.6)), 255]
  }
  if (head < 1.6) return [...light, Math.round(255 * 0.5 * (1.6 - head))]
  if (Math.abs(x - middle) <= 0.6 && y > HEAD * 2) return [46, 52, 60, 230]
  return [0, 0, 0, 0]
}

function postPixels(color: string): Uint8Array {
  const light = hexRgb(color)
  const data = new Uint8Array(POST_WIDTH * POST_HEIGHT * 4)
  for (let y = 0; y < POST_HEIGHT; y += 1)
    for (let x = 0; x < POST_WIDTH; x += 1)
      data.set(postPixel(x, y, light), (y * POST_WIDTH + x) * 4)
  return data
}

const painted = new WeakMap<MapLibreMap, string>()

export function ensureLampSprite(map: MapLibreMap, color: string) {
  if (!map.hasImage(LAMP_ICON))
    map.addImage(LAMP_ICON, { width: POOL, height: POOL, data: poolPixels() }, { sdf: true })
  const post = { width: POST_WIDTH, height: POST_HEIGHT, data: postPixels(color) }
  if (!map.hasImage(LAMP_POST_ICON)) map.addImage(LAMP_POST_ICON, post)
  else if (painted.get(map) !== color) map.updateImage(LAMP_POST_ICON, post)
  painted.set(map, color)
}
