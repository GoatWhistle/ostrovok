import type { Map as MapLibreMap, Marker } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useState } from "react"
import type { SearchResult } from "@/shared/api/hotel-types"
import { featureCollection } from "@/shared/geo/geometry"
import {
  createMarker,
  type HotelView,
  hotelPosition,
  type MarkerView,
  type PlaceView,
  removeMarkers,
} from "./marker-view"
import { useMarkerLabels } from "./markers/use-marker-labels"
import { useResultPins } from "./use-result-pins"

interface MarkerData {
  readonly mapRef: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly results: readonly SearchResult[]
  readonly hotelId: string | undefined
  readonly focusFeatures: readonly unknown[]
  readonly focusLabel: string | undefined
}

type Feature = ReturnType<typeof featureCollection>["features"][number]

function placeTarget(feature: Feature, fallback: string | undefined) {
  const props = feature.properties ?? {}
  if (feature.geometry.type === "Point" && typeof props.name === "string")
    return {
      kind: "place" as const,
      label: props.name,
      position: feature.geometry.coordinates as [number, number],
    }
  if (feature.geometry.type === "LineString" && feature.properties?.kind === "route" && fallback) {
    const end = feature.geometry.coordinates.at(-1) as [number, number] | undefined
    return end ? { kind: "route" as const, label: fallback, position: end } : null
  }
  return null
}

function useFocusPlaces(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  focusFeatures: readonly unknown[],
  focusLabel: string | undefined,
) {
  const [views, setViews] = useState<readonly PlaceView[]>([])
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !focusFeatures.length) return
    const markers: Marker[] = []
    const next: PlaceView[] = []
    featureCollection(focusFeatures).features.forEach((feature, index) => {
      const target = placeTarget(feature, focusLabel)
      if (!target) return
      const { element, marker } = createMarker(map, target.position, "center")
      markers.push(marker)
      next.push({ key: `place-${index}`, element, kind: target.kind, label: target.label })
    })
    setViews(next)
    return () => {
      removeMarkers(markers)
      setViews([])
    }
  }, [mapRef, ready, focusFeatures, focusLabel])
  return views
}

function useSelectedPin(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  result: SearchResult | undefined,
) {
  const [view, setView] = useState<Omit<HotelView, "result">>()
  const position = result ? hotelPosition(result) : undefined
  const id = result?.hotel.id
  const lon = position?.[0]
  const lat = position?.[1]
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !id || lon === undefined || lat === undefined) return
    const { element, marker } = createMarker(map, [lon, lat], "bottom", true)
    setView({ key: id, element, kind: "hotel", selected: true })
    return () => {
      marker.remove()
      setView(undefined)
    }
  }, [mapRef, ready, id, lon, lat])
  return useMemo<HotelView | undefined>(
    () => (view && result ? { ...view, result } : undefined),
    [view, result],
  )
}

export function useMapMarkers({
  mapRef,
  ready,
  results,
  hotelId,
  focusFeatures,
  focusLabel,
}: MarkerData): readonly MarkerView[] {
  const pins = useResultPins(mapRef, ready, results, hotelId)
  const places = useFocusPlaces(mapRef, ready, focusFeatures, focusLabel)
  const selected = useSelectedPin(
    mapRef,
    ready,
    results.find((item) => item.hotel.id === hotelId),
  )
  const views = useMemo(
    () => [...pins, ...places, ...(selected ? [selected] : [])],
    [pins, places, selected],
  )
  useMarkerLabels(mapRef, ready, views)
  return views
}
