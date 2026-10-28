import type { Map as MapLibreMap, Marker } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useState } from "react"
import type { HotelSummary, SearchResult } from "@/shared/api/hotel-types"
import { hotelPoint } from "@/shared/geo/buildings/hotel-point"
import { useLocale } from "@/shared/i18n"
import {
  createMarker,
  type HotelView,
  type MarkerView,
  type PlaceView,
  removeMarkers,
} from "./marker-view"
import { placeTargets } from "./markers/place-targets"
import { useMarkerLabels } from "./markers/use-marker-labels"
import { useResultPins } from "./use-result-pins"

interface MarkerData {
  readonly mapRef: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly results: readonly SearchResult[]
  readonly location: HotelSummary | undefined
  readonly hotelId: string | undefined
  readonly focusFeatures: readonly unknown[]
  readonly focusLabel: string | undefined
}

function useFocusPlaces(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  focusFeatures: readonly unknown[],
  focusLabel: string | undefined,
) {
  const { locale } = useLocale()
  const [views, setViews] = useState<readonly PlaceView[]>([])
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !focusFeatures.length) return
    const markers: Marker[] = []
    const next: PlaceView[] = []
    placeTargets(focusFeatures, focusLabel, locale).forEach((target, index) => {
      const { element, marker } = createMarker(map, target.position, "center")
      markers.push(marker)
      next.push({ key: `place-${index}`, element, ...target })
    })
    setViews(next)
    return () => {
      removeMarkers(markers)
      setViews([])
    }
  }, [mapRef, ready, focusFeatures, focusLabel, locale])
  return views
}

function useSelectedPin(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  result: SearchResult | undefined,
  location: HotelSummary | undefined,
) {
  const [view, setView] = useState<Omit<HotelView, "result">>()
  const identity = result?.hotel ?? location
  const position = hotelPoint(identity?.location)
  const id = identity?.id
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
  return useMemo<HotelView | PlaceView | undefined>(() => {
    if (!view || !identity) return undefined
    if (result) return { ...view, result }
    return {
      ...view,
      kind: "place",
      label: identity.name,
      ariaLabel: identity.name,
      placeId: undefined,
      quiet: false,
    }
  }, [view, result, identity])
}

export function useMapMarkers({
  mapRef,
  ready,
  results,
  hotelId,
  location,
  focusFeatures,
  focusLabel,
}: MarkerData): readonly MarkerView[] {
  const pins = useResultPins(mapRef, ready, results, hotelId)
  const places = useFocusPlaces(mapRef, ready, focusFeatures, focusLabel)
  const selected = useSelectedPin(
    mapRef,
    ready,
    results.find((item) => item.hotel.id === hotelId),
    location,
  )
  const views = useMemo(
    () => [...pins, ...places, ...(selected ? [selected] : [])],
    [pins, places, selected],
  )
  useMarkerLabels(mapRef, ready, views)
  return views
}
