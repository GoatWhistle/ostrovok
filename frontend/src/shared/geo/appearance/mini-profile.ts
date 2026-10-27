import type { Map as MapLibreMap } from "maplibre-gl"
import type { AppearancePackage } from "./types"

export function applyMiniProfile(map: MapLibreMap, appearance: AppearancePackage) {
  if (!appearance.mini.terrain && map.getTerrain()) map.setTerrain(null)
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === "fill-extrusion" && !appearance.mini.volumes)
      map.setLayoutProperty(layer.id, "visibility", "none")
  }
  for (const id of ["base-roads-glow", "base-roads-light", "route-glow"])
    if (map.getLayer(id) && !appearance.mini.lights) map.setLayoutProperty(id, "visibility", "none")
}
