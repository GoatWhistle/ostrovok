import type { Map as MapLibreMap, MapSourceDataEvent } from "maplibre-gl"
import { watchTerrainData } from "../night-city/terrain-watch"

const SETTLE_MS = 180

export function watchRoofTriggers(map: MapLibreMap, build: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = () => {
    if (!map.isMoving()) build()
  }
  const settle = () => {
    clearTimeout(timer)
    timer = setTimeout(run, SETTLE_MS)
  }
  const onTiles = (event: MapSourceDataEvent) => {
    if (event.sourceId === "sochi-map" && event.isSourceLoaded) settle()
  }
  settle()
  map.on("moveend", settle)
  map.on("sourcedata", onTiles)
  const unwatch = watchTerrainData(map, settle)
  return () => {
    clearTimeout(timer)
    map.off("moveend", settle)
    map.off("sourcedata", onTiles)
    unwatch()
  }
}
