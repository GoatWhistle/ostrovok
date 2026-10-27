import type { FeatureCollection } from "geojson"
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

export function sceneCollection(scene: MapRenderScene): FeatureCollection {
  return { type: "FeatureCollection", features: scene.features } as unknown as FeatureCollection
}

export interface DrawnVolume {
  readonly height: number
  readonly base: number
}

export function windowBuildings(
  map: MapLibreMap,
  scene: MapRenderScene,
  drawn: ReadonlyMap<string, DrawnVolume>,
  textured: ReadonlySet<string>,
): WindowBuilding[] {
  return scene.features.flatMap((feature) => {
    const id = feature.properties.building_id
    if (textured.has(id)) return []
    const rings = polygons(feature.geometry).flat()
    const outer = rings[0] ?? []
    if (outer.length === 0) return []
    const lon = outer.reduce((sum, [x]) => sum + x, 0) / outer.length
    const lat = outer.reduce((sum, [, y]) => sum + y, 0) / outer.length
    const volume = drawn.get(id)
    return [
      {
        id: feature.id,
        rings,
        ground: map.queryTerrainElevation([lon, lat]) ?? 0,
        base: volume?.base ?? feature.properties.min_height_m,
        height: volume?.height ?? feature.properties.render_height_m,
      },
    ]
  })
}

function metres(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

export function drawnVolumes(features: readonly unknown[]): ReadonlyMap<string, DrawnVolume> {
  const volumes = new Map<string, DrawnVolume>()
  for (const feature of features) {
    const properties = (feature as { readonly properties?: Record<string, unknown> }).properties
    const [id] = buildingIds([feature])
    if (id)
      volumes.set(id, {
        height: metres(properties?.height_m),
        base: metres(properties?.min_height_m),
      })
  }
  return volumes
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
