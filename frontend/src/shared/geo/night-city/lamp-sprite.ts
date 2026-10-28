import type { Map as MapLibreMap } from "maplibre-gl"

export const LAMP_ICON = "night-lamp"
const SIZE = 32

function lampPixels(): Uint8Array {
  const data = new Uint8Array(SIZE * SIZE * 4)
  const middle = (SIZE - 1) / 2
  for (let y = 0; y < SIZE; y += 1)
    for (let x = 0; x < SIZE; x += 1) {
      const distance = Math.hypot(x - middle, y - middle) / middle
      const at = (y * SIZE + x) * 4
      data[at] = 255
      data[at + 1] = 255
      data[at + 2] = 255
      data[at + 3] = Math.round(255 * Math.max(0, 1 - distance) ** 0.8)
    }
  return data
}

export function ensureLampSprite(map: MapLibreMap) {
  if (map.hasImage(LAMP_ICON)) return
  map.addImage(LAMP_ICON, { width: SIZE, height: SIZE, data: lampPixels() }, { sdf: true })
}
