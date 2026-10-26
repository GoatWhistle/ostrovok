import type { Map as MapLibreMap, MapSourceDataEvent } from "maplibre-gl"

const SETTLE_MS = 250

export function watchTerrainData(map: MapLibreMap, onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const settle = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, SETTLE_MS)
  }
  const onData = (event: MapSourceDataEvent) => {
    if (event.tile !== undefined && event.sourceId === map.getTerrain()?.source) settle()
  }
  map.on("sourcedata", onData)
  map.on("terrain", settle)
  return () => {
    clearTimeout(timer)
    map.off("sourcedata", onData)
    map.off("terrain", settle)
  }
}
