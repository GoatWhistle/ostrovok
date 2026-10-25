import { type LngLatLike, type Map as MapLibreMap, Marker } from "maplibre-gl"
import type { SearchResult } from "@/shared/api/hotel-types"
import styles from "./map-pin.module.css"

export type LabelEdge = "start" | "center" | "end"

interface ViewBase {
  readonly key: string
  readonly element: HTMLElement
}

export interface HotelView extends ViewBase {
  readonly kind: "hotel"
  readonly result: SearchResult
  readonly selected: boolean
  readonly edge: LabelEdge
  readonly below: boolean
}

export interface ClusterView extends ViewBase {
  readonly kind: "cluster"
  readonly count: number
  readonly clusterId: number
  readonly position: [number, number]
}

export interface PlaceView extends ViewBase {
  readonly kind: "place" | "route"
  readonly label: string
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

export function labelPlacement(map: MapLibreMap, marker: Marker) {
  const point = map.project(marker.getLngLat())
  const container = map.getContainer()
  const width = Number.parseFloat(
    getComputedStyle(container).getPropertyValue("--workspace-marker-width"),
  )
  const half = Number.isFinite(width) ? width / 2 : 0
  const edge: LabelEdge =
    point.x < half ? "start" : point.x > container.clientWidth - half ? "end" : "center"
  return { edge, below: point.y < half }
}

export function hotelPosition(result: SearchResult): [number, number] | undefined {
  const [lon, lat] = result.hotel.location
  if (lon === undefined || lat === undefined || !Number.isFinite(lon) || !Number.isFinite(lat))
    return undefined
  return [lon, lat]
}

export function removeMarkers(markers: Iterable<Marker>) {
  for (const marker of markers) marker.remove()
}
