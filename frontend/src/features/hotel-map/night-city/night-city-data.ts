import type { Map as MapLibreMap } from "maplibre-gl"
import type { MapRenderScene } from "@/entities/map-data"
import type { WindowBuilding } from "@/shared/geo/night-city/window-mesh"

export interface RegionBox {
  readonly id: string
  readonly bbox: readonly number[]
}

type Ring = readonly (readonly [number, number])[]

export function regionFor(
  regions: readonly RegionBox[],
  center: readonly [number, number],
): string | undefined {
  const [lon, lat] = center
  return regions
    .filter(({ bbox: [west = 0, south = 0, east = 0, north = 0] }) => {
      return lon >= west && lon <= east && lat >= south && lat <= north
    })
    .sort((left, right) => area(left.bbox) - area(right.bbox))[0]?.id
}

function area([west = 0, south = 0, east = 0, north = 0]: readonly number[]) {
  return (east - west) * (north - south)
}

export function rgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  if (!Number.isFinite(value)) return [1, 1, 1]
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

function polygons(geometry: { readonly type: string; readonly coordinates: unknown[] }): Ring[][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as Ring[]]
  if (geometry.type === "MultiPolygon") return geometry.coordinates as Ring[][]
  return []
}

export function windowBuildings(
  map: MapLibreMap,
  scene: MapRenderScene,
  excluded: ReadonlySet<string>,
): WindowBuilding[] {
  return scene.features.flatMap((feature) => {
    if (excluded.has(feature.properties.building_id)) return []
    const rings = polygons(feature.geometry).flat()
    const [lon, lat] = rings[0]?.[0] ?? []
    if (lon === undefined || lat === undefined) return []
    return [
      {
        id: feature.id,
        rings,
        ground: map.queryTerrainElevation([lon, lat]) ?? 0,
        base: feature.properties.min_height_m,
        height: feature.properties.render_height_m,
      },
    ]
  })
}

export function buildingIds(features: readonly unknown[]): string[] {
  return features.flatMap((feature) => {
    const value = feature as {
      readonly id?: unknown
      readonly properties?: { readonly building_id?: unknown }
    }
    const id = value.properties?.building_id ?? value.id
    return typeof id === "string" ? [id] : []
  })
}
