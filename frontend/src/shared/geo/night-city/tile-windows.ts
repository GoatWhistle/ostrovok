import type { Map as MapLibreMap } from "maplibre-gl"
import { roofInputs, tileCandidates } from "../roof-mesh/sources"
import type { WindowBuilding } from "./window-mesh"

const MIN_ZOOM = 14.5

export function tileWindowBuildings(
  map: MapLibreMap,
  skip: ReadonlySet<string>,
  center: readonly [number, number],
): WindowBuilding[] {
  if (map.getZoom() < MIN_ZOOM) return []
  return roofInputs(map, tileCandidates(map, skip), center).map((input) => ({
    id: input.id,
    rings: input.bodies.length > 0 ? input.bodies : [input.ring],
    ground: input.ground,
    base: 0,
    height: input.height,
  }))
}
