import { type LngLatLike, type Map as MapLibreMap, Marker } from "maplibre-gl"
import type { SearchResult } from "@/shared/api/hotel-types"
import { hotelPoint } from "@/shared/geo/hotel-point"
import styles from "./map-pin.module.css"

interface ViewBase {
  readonly key: string
  readonly element: HTMLElement
}

export interface HotelView extends ViewBase {
  readonly kind: "hotel"
  readonly result: SearchResult
  readonly selected: boolean
}

export interface ClusterView extends ViewBase {
  readonly kind: "cluster"
  readonly count: number
  readonly onSpread?: () => void
  readonly clusterId: number
  readonly position: [number, number]
}

export interface PlaceView extends ViewBase {
  readonly kind: "place" | "route"
  readonly label: string
  readonly ariaLabel: string
  readonly placeId: string | undefined
  readonly quiet: boolean
}

export type MarkerView = HotelView | ClusterView | PlaceView

export function createMarker(
  map: MapLibreMap,
  position: LngLatLike,
  anchor: "bottom" | "center",
  selected = false,
) {
  const element = document.createElement("div")
  element.className = styles.host ?? ""
  element.dataset.selected = String(selected)
  const marker = new Marker({ element, anchor }).setLngLat(position).addTo(map)
  return { element, marker }
}

export function hotelPosition(result: SearchResult): [number, number] | undefined {
  return hotelPoint(result.hotel.location)
}

export function removeMarkers(markers: Iterable<Marker>) {
  for (const marker of markers) marker.remove()
}
