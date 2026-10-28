import type { Map as MapLibreMap } from "maplibre-gl"
import type { RefObject } from "react"
import { createPortal } from "react-dom"
import type { SearchResult } from "@/shared/api/hotel-types"
import { motionMs, prefersReducedMotion } from "@/shared/motion"
import { MapPin } from "../map-pin"
import type { MarkerView } from "../marker-view"
import { FLIGHT_CURVE, hotelView } from "../rendering/hotel-flight"
import { expandCluster } from "../use-result-pins"

export interface MapPinsProps {
  readonly views: readonly MarkerView[]
  readonly map: RefObject<MapLibreMap | null>
  readonly onPlace: (id: string) => void
  readonly onSelect: (result: SearchResult) => void
}

function flyToHotel(map: MapLibreMap | null, result: SearchResult) {
  const view = map ? hotelView(result, map.getBearing()) : undefined
  if (!map || !view) return
  map.stop()
  if (prefersReducedMotion()) map.jumpTo(view)
  else map.flyTo({ ...view, curve: FLIGHT_CURVE, duration: motionMs("--dur-draw") })
}

export function MapPins({ views, map, onSelect, onPlace }: MapPinsProps) {
  return views.map((view) =>
    createPortal(
      <MapPin
        view={view}
        onPlace={onPlace}
        onSelect={(result) => {
          if (view.kind === "hotel" && view.selected) flyToHotel(map.current, result)
          onSelect(result)
        }}
        onExpand={(cluster, keyboard) => {
          if (cluster.onSpread) {
            cluster.onSpread()
            return
          }
          const instance = map.current
          if (instance)
            void expandCluster(
              instance,
              cluster.clusterId,
              cluster.position,
              keyboard || prefersReducedMotion(),
              motionMs("--dur-panel"),
            )
        }}
      />,
      view.element,
      view.key,
    ),
  )
}
