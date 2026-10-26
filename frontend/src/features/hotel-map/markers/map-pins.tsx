import type { Map as MapLibreMap } from "maplibre-gl"
import type { RefObject } from "react"
import { createPortal } from "react-dom"
import type { SearchResult } from "@/shared/api/hotel-types"
import { motionMs } from "@/shared/motion"
import { MapPin } from "../map-pin"
import type { MarkerView } from "../marker-view"
import { expandCluster } from "../use-result-pins"

export interface MapPinsProps {
  readonly views: readonly MarkerView[]
  readonly map: RefObject<MapLibreMap | null>
  readonly onSelect: (result: SearchResult) => void
}

export function MapPins({ views, map, onSelect }: MapPinsProps) {
  return views.map((view) =>
    createPortal(
      <MapPin
        view={view}
        onSelect={onSelect}
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
              keyboard,
              motionMs("--dur-panel"),
            )
        }}
      />,
      view.element,
      view.key,
    ),
  )
}
