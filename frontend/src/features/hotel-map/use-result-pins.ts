import type { FeatureCollection, Point } from "geojson"
import type { GeoJSONSource, MapGeoJSONFeature, Map as MapLibreMap, Marker } from "maplibre-gl"
import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
import type { SearchResult } from "@/shared/api/hotel-types"
import { createMarker, hotelPosition, type MarkerView, removeMarkers } from "./marker-view"
import { stackViews } from "./markers/spiderfy"
import { clusterZoom, fitOptions } from "./rendering/fit-zoom"

const SOURCE = "hotel-results"

function resultData(results: readonly SearchResult[], hotelId: string | undefined) {
  const features = results.flatMap((result) => {
    const position = hotelPosition(result)
    if (!position || result.hotel.id === hotelId || result.hotel.name === result.hotel.id) return []
    return [
      {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: position },
        properties: { id: result.hotel.id },
      },
    ]
  })
  return { type: "FeatureCollection", features } satisfies FeatureCollection
}

function ensureSource(map: MapLibreMap, data: FeatureCollection) {
  const source = map.getSource<GeoJSONSource>(SOURCE)
  if (source) {
    source.setData(data)
    return
  }
  map.addSource(SOURCE, {
    type: "geojson",
    data,
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 15,
  })
  map.addLayer({
    id: SOURCE,
    type: "circle",
    source: SOURCE,
    paint: { "circle-radius": 1, "circle-opacity": 0 },
  })
}

function viewFor(
  feature: MapGeoJSONFeature,
  marker: Marker,
  result: SearchResult | undefined,
): MarkerView | null {
  const props = feature.properties
  const key = featureKey(feature)
  const element = marker.getElement()
  if (props.cluster === true)
    return {
      key,
      element,
      kind: "cluster",
      count: Number(props.point_count),
      clusterId: Number(props.cluster_id),
      position: (feature.geometry as Point).coordinates as [number, number],
    }
  if (!result) return null
  return { key, element, kind: "hotel", result, selected: false }
}

function featureKey(feature: MapGeoJSONFeature) {
  const props = feature.properties
  return props.cluster === true ? `cluster-${props.cluster_id}` : String(props.id)
}

function prune(markers: Map<string, Marker>, seen: ReadonlySet<string>) {
  for (const [key, marker] of markers)
    if (!seen.has(key)) {
      marker.remove()
      markers.delete(key)
    }
}

function collect(
  map: MapLibreMap,
  markers: Map<string, Marker>,
  results: readonly SearchResult[],
): MarkerView[] {
  if (!map.getLayer(SOURCE) || !map.isSourceLoaded(SOURCE)) return []
  const views: MarkerView[] = []
  const seen = new Set<string>()
  for (const feature of map.queryRenderedFeatures({ layers: [SOURCE] })) {
    const key = featureKey(feature)
    const result = results.find((item) => item.hotel.id === feature.properties.id)
    if (seen.has(key) || (feature.properties.cluster !== true && !result)) continue
    seen.add(key)
    const position = (feature.geometry as Point).coordinates as [number, number]
    const marker = markers.get(key) ?? createMarker(map, position, "bottom").marker
    markers.set(key, marker)
    const view = viewFor(feature, marker, result)
    if (view) views.push(view)
  }
  prune(markers, seen)
  return views
}

function signature(views: readonly MarkerView[]) {
  return views.map((view) => view.key).join("|")
}

export function useResultPins(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  results: readonly SearchResult[],
  hotelId: string | undefined,
) {
  const [views, setViews] = useState<readonly MarkerView[]>([])
  const latest = useRef(results)
  latest.current = results
  const key = JSON.stringify(resultData(results, hotelId))
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ensureSource(map, JSON.parse(key) as FeatureCollection)
    const markers = new Map<string, Marker>()
    let last = ""
    let expanded: string | undefined
    const sync = () => {
      const next = stackViews(
        map,
        markers,
        collect(map, markers, latest.current),
        expanded,
        (key) => {
          expanded = key
          sync()
        },
      )
      const current = signature(next)
      if (current === last) return
      last = current
      setViews(next)
    }
    const collapse = () => {
      expanded = undefined
      sync()
    }
    map.on("movestart", collapse)
    map.on("idle", sync)
    map.on("moveend", sync)
    sync()
    return () => {
      map.off("movestart", collapse)
      map.off("idle", sync)
      map.off("moveend", sync)
      removeMarkers(markers.values())
      setViews([])
    }
  }, [mapRef, ready, key])
  return useMemo(
    () =>
      views.map((view) => {
        if (view.kind !== "hotel") return view
        const result = results.find((item) => item.hotel.id === view.key)
        return result ? { ...view, result } : view
      }),
    [views, results],
  )
}

export async function expandCluster(
  map: MapLibreMap,
  clusterId: number,
  position: [number, number],
  instant: boolean,
  duration: number,
) {
  const source = map.getSource<GeoJSONSource>(SOURCE)
  if (!source) return
  const zoom = await source.getClusterExpansionZoom(clusterId)
  if (zoom > 16) {
    const leaves = await source.getClusterLeaves(clusterId, 1000, 0)
    const points = leaves.map((item) => (item.geometry as Point).coordinates)
    const longitudes = points.map((point) => point[0] ?? position[0])
    const latitudes = points.map((point) => point[1] ?? position[1])
    if (points.length) {
      map.fitBounds(
        [
          [Math.min(...longitudes), Math.min(...latitudes)],
          [Math.max(...longitudes), Math.max(...latitudes)],
        ],
        fitOptions({ padding: 48, duration: instant ? 0 : duration }),
      )
      return
    }
  }
  map.easeTo({
    center: position,
    zoom: clusterZoom(zoom, map.getZoom(), map.getMaxZoom()),
    duration: instant ? 0 : duration,
  })
}
