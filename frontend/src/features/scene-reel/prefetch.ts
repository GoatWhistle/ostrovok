import { warmCache } from "@/shared/api"
import { TERRAIN_TILE_VERSION } from "@/shared/geo/terrain"
import type { Shot } from "./shots"

const DEM_PATH = "/api/v1/map/terrain"
const DEM_MAX_ZOOM = 14
const DEM_MIN_ZOOM = 0
const SPREAD = 1
const DEPTH = 0

function tileOf(lon: number, lat: number, zoom: number) {
  const scale = 2 ** zoom
  const radians = (lat * Math.PI) / 180
  const x = Math.floor(((lon + 180) / 360) * scale)
  const y = Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * scale)
  return { x, y, scale }
}

export function shotTiles(shot: Shot): string[] {
  const [lon, lat] = shot.from.center
  const top = Math.min(DEM_MAX_ZOOM, Math.floor(shot.from.zoom))
  const urls: string[] = []
  for (let zoom = top; zoom >= Math.max(DEM_MIN_ZOOM, top - DEPTH); zoom -= 1) {
    const center = tileOf(lon, lat, zoom)
    for (let dx = -SPREAD; dx <= SPREAD; dx += 1)
      for (let dy = -SPREAD; dy <= SPREAD; dy += 1) {
        const x = (center.x + dx + center.scale) % center.scale
        const y = center.y + dy
        if (y >= 0 && y < center.scale)
          urls.push(`${DEM_PATH}/${zoom}/${x}/${y}.png?v=${TERRAIN_TILE_VERSION}`)
      }
  }
  return urls
}

export function prefetchShot(shot: Shot) {
  return warmCache(shotTiles(shot))
}
