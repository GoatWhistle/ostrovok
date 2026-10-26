import type { FeatureCollection, LineString } from "geojson"
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl"
import type { HotelView, MarkerView } from "../marker-view"
import { spiderOffsets, stackGroups } from "./stack-layout"

const SOURCE = "hotel-stack-legs"
const signatures = new WeakMap<MapLibreMap, string>()

function paintLegs(map: MapLibreMap, data: FeatureCollection<LineString>) {
  const signature = JSON.stringify(data)
  if (signatures.get(map) === signature) return
  signatures.set(map, signature)
  const source = map.getSource<GeoJSONSource>(SOURCE)
  if (source) {
    source.setData(data)
    return
  }
  map.addSource(SOURCE, { type: "geojson", data })
  map.addLayer({
    id: SOURCE,
    type: "line",
    source: SOURCE,
    paint: {
      "line-width": 1,
      "line-color": getComputedStyle(map.getContainer()).getPropertyValue("--map-route").trim(),
    },
  })
}

function spread(
  map: MapLibreMap,
  markers: ReadonlyMap<string, Marker>,
  group: readonly HotelView[],
): FeatureCollection<LineString>["features"] {
  const offsets = spiderOffsets(group.length)
  return group.flatMap((view, index) => {
    const marker = markers.get(view.key)
    const offset = offsets[index]
    if (!marker || !offset) return []
    marker.setOffset(offset)
    const origin = marker.getLngLat()
    const point = map.project(origin)
    const target = map.unproject([point.x + offset[0], point.y + offset[1]])
    return [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: [origin.toArray(), target.toArray()],
        },
      },
    ]
  })
}

function collapse(group: readonly HotelView[], onSpread: (key: string) => void): MarkerView[] {
  const first = group[0]
  if (!first) return []
  for (const view of group.slice(1)) view.element.hidden = true
  return [
    {
      key: `stack-${first.key}`,
      kind: "cluster",
      element: first.element,
      count: group.length,
      clusterId: -1,
      position: [first.result.hotel.location[0] ?? 0, first.result.hotel.location[1] ?? 0],
      onSpread: () => onSpread(first.key),
    },
  ]
}

export function stackViews(
  map: MapLibreMap,
  markers: ReadonlyMap<string, Marker>,
  views: readonly MarkerView[],
  expanded: string | undefined,
  onSpread: (key: string) => void,
): MarkerView[] {
  for (const marker of markers.values()) {
    marker.getElement().hidden = false
    marker.setOffset([0, 0])
  }
  const lines: FeatureCollection<LineString> = { type: "FeatureCollection", features: [] }
  if (map.getZoom() < 18) {
    if (map.getSource(SOURCE)) paintLegs(map, lines)
    return [...views]
  }
  const hotels = views.filter((view): view is HotelView => view.kind === "hotel")
  const points = hotels.map((view) =>
    map.project([view.result.hotel.location[0] ?? 0, view.result.hotel.location[1] ?? 0]),
  )
  const grouped = stackGroups(points).flatMap<MarkerView>((indexes) => {
    const group = indexes.flatMap((index) => (hotels[index] ? [hotels[index]] : []))
    if (group.length < 2) return group
    if (group[0]?.key !== expanded) return collapse(group, onSpread)
    lines.features.push(...spread(map, markers, group))
    return group
  })
  paintLegs(map, lines)
  return [...views.filter((view) => view.kind !== "hotel"), ...grouped]
}
