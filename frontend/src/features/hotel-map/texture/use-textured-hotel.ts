import { useQuery } from "@tanstack/react-query"
import type { FeatureCollection } from "geojson"
import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useEffect, useRef, useState } from "react"
import { labelAnchor } from "@/shared/geo/basemap-labels"
import { type BuildingColors, renderBuildings } from "@/shared/geo/map-layers"
import type { SunPosition } from "@/shared/geo/terrain"
import { buildingMesh } from "@/shared/geo/textured-building/geometry"
import { TexturedBuildingLayer } from "@/shared/geo/textured-building/layer"
import { HOTEL_ALBEDO } from "@/shared/geo/textured-building/material"
import {
  remainingBuildings,
  type TexturedFootprint,
} from "@/shared/geo/textured-building/selection"

export type HotelTextureStatus = "none" | "ready" | "unavailable"

interface TexturedHotelOptions {
  readonly mapRef: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly hotelId: string | undefined
  readonly footprints: readonly TexturedFootprint[]
  readonly buildings: FeatureCollection
  readonly colors: BuildingColors
  readonly sun: SunPosition
}

function loadAlbedo() {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Hotel albedo unavailable"))
    image.src = HOTEL_ALBEDO
  })
}

export function useTexturedHotel({
  mapRef,
  ready,
  hotelId,
  footprints,
  buildings,
  colors,
  sun,
}: TexturedHotelOptions) {
  const layer = useRef<TexturedBuildingLayer | null>(null)
  const [status, setStatus] = useState<HotelTextureStatus>("none")
  const enabled = ready && footprints.length > 0 && hotelId !== undefined
  const albedo = useQuery({
    queryKey: ["hotel-albedo", HOTEL_ALBEDO],
    queryFn: loadAlbedo,
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
  const palette = useRef(colors)
  const data = useRef(buildings)
  palette.current = colors
  data.current = buildings
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const selected = layer.current?.hotelId === hotelId ? footprints : []
    renderBuildings(map, remainingBuildings(buildings, selected), colors)
  }, [mapRef, ready, hotelId, footprints, buildings, colors])
  useEffect(() => {
    const map = mapRef.current
    setStatus("none")
    if (!map || !ready || !hotelId || !albedo.data) return
    const mesh = buildingMesh(footprints)
    if (!mesh) return
    const current = new TexturedBuildingLayer(hotelId, mesh, albedo.data)
    const activate = () => {
      if (layer.current !== current) return
      try {
        map.addLayer(current, labelAnchor(map))
        renderBuildings(map, remainingBuildings(data.current, footprints), palette.current)
        setStatus("ready")
      } catch {
        current.onRemove()
        if (map.getLayer(current.id)) map.removeLayer(current.id)
        layer.current = null
        renderBuildings(map, data.current, palette.current)
        setStatus("unavailable")
      }
    }
    const restore = () => {
      if (map.isStyleLoaded()) activate()
      else map.once("style.load", activate)
    }
    layer.current = current
    activate()
    map.on("webglcontextrestored", restore)
    return () => {
      map.off("webglcontextrestored", restore)
      map.off("style.load", activate)
      if (map.getLayer(current.id)) map.removeLayer(current.id)
      layer.current = null
    }
  }, [mapRef, ready, hotelId, footprints, albedo.data])
  useEffect(() => {
    if (status !== "ready" || !layer.current) return
    layer.current.sun = sun
    mapRef.current?.triggerRepaint()
  }, [mapRef, sun, status])
  if (!enabled) return "none"
  return albedo.isError ? "unavailable" : status
}
