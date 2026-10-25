import { type Map as MapLibreMap, Marker } from "maplibre-gl"
import { type RefObject, useEffect } from "react"
import type { SearchResult } from "@/shared/api/hotel-types"
import { featureCollection } from "@/shared/geo/geometry"
import styles from "./hotel-map.module.css"

interface MarkerData {
  mapRef: RefObject<MapLibreMap | null>
  ready: boolean
  results: readonly SearchResult[]
  hotelId: string | undefined
  onSelect: (result: SearchResult) => void
  focusFeatures: readonly unknown[]
  focusLabel: string | undefined
}

function featureMarker(
  map: MapLibreMap,
  feature: ReturnType<typeof featureCollection>["features"][number],
  fallback: string | undefined,
) {
  const props = feature.properties ?? {}
  let position: [number, number] | undefined
  let label: string | undefined
  if (feature.geometry.type === "Point") {
    position = feature.geometry.coordinates as [number, number]
    label = typeof props.name === "string" ? props.name : undefined
  }
  if (feature.geometry.type === "LineString") {
    position = feature.geometry.coordinates.at(-1) as [number, number] | undefined
    label = fallback
  }
  if (!position || !label) return null
  const element = document.createElement("div")
  element.className = styles.placeMarker ?? ""
  element.textContent = label
  return new Marker({ element, anchor: "bottom" }).setLngLat(position).addTo(map)
}

function hotelPoint(map: MapLibreMap, result: SearchResult) {
  const [lon, lat] = result.hotel.location
  if (lon === undefined || lat === undefined || !Number.isFinite(lon) || !Number.isFinite(lat))
    return null
  const point = map.project([lon, lat])
  const canvas = map.getCanvas()
  if (
    point.x < 70 ||
    point.x > canvas.clientWidth - 70 ||
    point.y < 70 ||
    point.y > canvas.clientHeight - 110
  )
    return null
  return { lon, lat, x: point.x, y: point.y }
}

function hotelMarkers(
  map: MapLibreMap,
  results: readonly SearchResult[],
  onSelect: MarkerData["onSelect"],
) {
  const markers: Marker[] = []
  const placed: { x: number; y: number }[] = []
  const limit = map.getCanvas().clientWidth < 500 ? 2 : 5
  results.forEach((result, index) => {
    if (markers.length >= limit || result.hotel.name === result.hotel.id) return
    const point = hotelPoint(map, result)
    if (!point) return
    if (placed.some((item) => Math.abs(point.x - item.x) < 135 && Math.abs(point.y - item.y) < 48))
      return
    const button = document.createElement("button")
    button.type = "button"
    button.className = styles.hotelMarker ?? ""
    button.textContent = `${index + 1}. ${result.hotel.name}`
    button.addEventListener("click", () => onSelect(result))
    markers.push(
      new Marker({ element: button, anchor: "bottom" })
        .setLngLat([point.lon, point.lat])
        .addTo(map),
    )
    placed.push(point)
  })
  return markers
}

function removeMarkers(markers: readonly Marker[]) {
  markers.forEach((marker) => {
    marker.remove()
  })
}

function selectedHotelMarker(map: MapLibreMap, result: SearchResult) {
  const [lon, lat] = result.hotel.location
  if (lon === undefined || lat === undefined) return null
  const element = document.createElement("div")
  element.className = styles.selectedMarker ?? ""
  element.textContent = result.hotel.name
  return new Marker({ element, anchor: "bottom" }).setLngLat([lon, lat]).addTo(map)
}

export function useMapMarkers({
  mapRef,
  ready,
  results,
  hotelId,
  onSelect,
  focusFeatures,
  focusLabel,
}: MarkerData) {
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !focusFeatures.length) return
    const markers = featureCollection(focusFeatures)
      .features.map((feature) => featureMarker(map, feature, focusLabel))
      .filter((marker): marker is Marker => marker !== null)
    return () => removeMarkers(markers)
  }, [mapRef, ready, focusFeatures, focusLabel])
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || hotelId) return
    let markers: Marker[] = []
    const render = () => {
      removeMarkers(markers)
      markers = hotelMarkers(map, results, onSelect)
    }
    render()
    map.on("moveend", render)
    return () => {
      map.off("moveend", render)
      removeMarkers(markers)
    }
  }, [mapRef, ready, results, hotelId, onSelect])
  useEffect(() => {
    const map = mapRef.current
    const result = results.find((item) => item.hotel.id === hotelId)
    if (!ready || !map || !result) return
    const marker = selectedHotelMarker(map, result)
    return () => {
      marker?.remove()
    }
  }, [mapRef, ready, results, hotelId])
}
