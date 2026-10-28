import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl"
import { type RefObject, useEffect } from "react"
import type { SearchJourney } from "@/shared/api/search-journey"
import type { MapColors } from "@/shared/theme"

const SOURCE = "search-candidates"
const LAYER = "search-candidate-points"
export function useCandidatePins(
  map: RefObject<MapLibreMap | null>,
  ready: boolean,
  journey: SearchJourney | undefined,
  colors: MapColors,
  onSelect: (id: string) => void,
  focusedId: string | undefined,
) {
  const key = JSON.stringify(journey?.candidates.filter((hotel) => hotel.id !== focusedId) ?? [])
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return
    const candidates = JSON.parse(key) as SearchJourney["candidates"]
    const data = {
      type: "FeatureCollection" as const,
      features: candidates
        .filter((hotel) => hotel.location.length === 2 && hotel.location.every(Number.isFinite))
        .map((hotel) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [...hotel.location] },
          properties: { id: hotel.id, name: hotel.name },
        })),
    }
    const source = instance.getSource<GeoJSONSource>(SOURCE)
    if (source) source.setData(data)
    else
      instance.addSource(SOURCE, {
        type: "geojson",
        data,
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 15,
      })
    if (!instance.getLayer(LAYER))
      instance.addLayer({
        id: LAYER,
        type: "circle",
        source: SOURCE,
        paint: {
          "circle-radius": ["case", ["has", "point_count"], 14, 7],
          "circle-color": colors.hotelSelected,
          "circle-stroke-color": colors.label,
          "circle-stroke-width": 2,
        },
      })
    if (!instance.getLayer(`${LAYER}-labels`))
      instance.addLayer({
        id: `${LAYER}-labels`,
        type: "symbol",
        source: SOURCE,
        layout: {
          "text-field": [
            "case",
            ["has", "point_count"],
            ["to-string", ["get", "point_count"]],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Medium"],
          "text-size": 12,
          "text-offset": [
            "case",
            ["has", "point_count"],
            ["literal", [0, 0]],
            ["literal", [0, 1.5]],
          ],
        },
        paint: {
          "text-color": colors.label,
          "text-halo-color": colors.labelHalo,
          "text-halo-width": 1,
        },
      })
    const click = async (event: MapMouseEvent) => {
      const feature = instance.queryRenderedFeatures(event.point, { layers: [LAYER] })[0]
      if (feature?.geometry.type !== "Point") return
      if (feature.properties.cluster) {
        const source = instance.getSource<GeoJSONSource>(SOURCE)
        if (!source) return
        const zoom = await source.getClusterExpansionZoom(Number(feature.properties.cluster_id))
        instance.jumpTo({
          center: [feature.geometry.coordinates[0] ?? 0, feature.geometry.coordinates[1] ?? 0],
          zoom,
        })
      } else onSelect(String(feature.properties.id))
    }
    instance.on("click", LAYER, click)
    return () => {
      instance.off("click", LAYER, click)
      instance
        .getSource<GeoJSONSource>(SOURCE)
        ?.setData({ type: "FeatureCollection", features: [] })
    }
  }, [map, ready, key, colors, onSelect])
}
